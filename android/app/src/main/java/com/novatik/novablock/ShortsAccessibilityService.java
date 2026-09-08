package com.novatik.novablock;

import android.accessibilityservice.AccessibilityService;
import android.graphics.PixelFormat;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import java.util.ArrayList;
import java.util.List;

public final class ShortsAccessibilityService extends AccessibilityService {
    private static final String YOUTUBE_PACKAGE = "com.google.android.youtube";
    private static final long BLOCK_COOLDOWN_MS = 1400L;
    private static final long OVERLAY_DURATION_MS = 2200L;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable inspectRunnable = this::inspectPendingScreen;
    private final Runnable hideOverlayRunnable = this::hideOverlay;

    private boolean pendingExplicitEntry;
    private boolean inspectionScheduled;
    private long lastBlockAt;
    private View overlay;
    private WindowManager windowManager;
    private boolean backSucceeded;

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null || event.getPackageName() == null) return;
        if (!YOUTUBE_PACKAGE.contentEquals(event.getPackageName())) return;
        if (overlay != null || SystemClock.elapsedRealtime() - lastBlockAt < BLOCK_COOLDOWN_MS) return;

        boolean explicitEntry = false;
        if (event.getEventType() == AccessibilityEvent.TYPE_VIEW_CLICKED) {
            int[] sourceBudget = {80};
            explicitEntry = ShortsDetector.isExplicitShortsEntry(
                    snapshot(event.getSource(), 0, sourceBudget));
        }

        pendingExplicitEntry = pendingExplicitEntry || explicitEntry;
        if (explicitEntry) {
            // Le clic est signalé avant la fin de la transition YouTube. Ce
            // court délai empêche le retour de s'appliquer à l'écran précédent.
            handler.removeCallbacks(inspectRunnable);
            inspectionScheduled = true;
            handler.postDelayed(inspectRunnable, 240L);
        } else if (!inspectionScheduled) {
            // Déclenchement en tête : un flux continu d'événements ne peut pas
            // repousser indéfiniment la détection.
            inspectionScheduled = true;
            handler.postDelayed(inspectRunnable, 80L);
        }
    }

    private void inspectPendingScreen() {
        inspectionScheduled = false;
        boolean forcedByEntry = pendingExplicitEntry;
        pendingExplicitEntry = false;
        if (overlay != null || SystemClock.elapsedRealtime() - lastBlockAt < BLOCK_COOLDOWN_MS) return;

        AccessibilityNodeInfo root = getRootInActiveWindow();
        int[] budget = {900};
        ShortsDetector.Result result = ShortsDetector.analyze(snapshot(root, 0, budget));
        if (forcedByEntry || result.shortsScreen) blockShorts();
    }

    private void blockShorts() {
        lastBlockAt = SystemClock.elapsedRealtime();
        backSucceeded = performGlobalAction(GLOBAL_ACTION_BACK);

        getSharedPreferences("novablock", MODE_PRIVATE)
                .edit()
                .putLong("lastBlockAt", System.currentTimeMillis())
                .apply();

        // Le retour système est exécuté avant l'affichage. L'écran situé sous
        // Novablock est donc déjà l'endroit exact où l'utilisateur se trouvait.
        handler.postDelayed(this::showOverlay, backSucceeded ? 170L : 30L);
    }

    private void showOverlay() {
        if (overlay != null) return;
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        overlay = LayoutInflater.from(this).inflate(R.layout.overlay_blocked, null, false);
        overlay.setOnClickListener(view -> finishOverlay());

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.MATCH_PARENT,
                WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
        params.gravity = Gravity.TOP | Gravity.START;
        params.setTitle("Novablock — Short bloqué");

        try {
            windowManager.addView(overlay, params);
            overlay.requestFocus();
            handler.removeCallbacks(hideOverlayRunnable);
            handler.postDelayed(hideOverlayRunnable, OVERLAY_DURATION_MS);
        } catch (RuntimeException error) {
            overlay = null;
        }
    }

    private void finishOverlay() {
        // Rare repli si Android avait temporairement refusé GLOBAL_ACTION_BACK.
        if (!backSucceeded) performGlobalAction(GLOBAL_ACTION_BACK);
        hideOverlay();
    }

    private void hideOverlay() {
        handler.removeCallbacks(hideOverlayRunnable);
        if (overlay == null || windowManager == null) return;
        try {
            windowManager.removeView(overlay);
        } catch (RuntimeException ignored) {
            // La fenêtre a pu être retirée par le système lors d'un verrouillage.
        } finally {
            overlay = null;
        }
    }

    private ShortsDetector.NodeSnapshot snapshot(
            AccessibilityNodeInfo node,
            int depth,
            int[] remaining) {
        if (node == null || depth > 32 || remaining[0] <= 0) return null;
        remaining[0] -= 1;

        String viewId = safe(node.getViewIdResourceName());
        String text = safe(node.getText());
        String description = safe(node.getContentDescription());
        boolean clickable = node.isClickable();
        List<ShortsDetector.NodeSnapshot> children = new ArrayList<>();

        int count = Math.min(node.getChildCount(), 80);
        for (int index = 0; index < count && remaining[0] > 0; index += 1) {
            ShortsDetector.NodeSnapshot child = snapshot(node.getChild(index), depth + 1, remaining);
            if (child != null) children.add(child);
        }
        return new ShortsDetector.NodeSnapshot(viewId, text, description, clickable, children);
    }

    private static String safe(CharSequence value) {
        return value == null ? "" : value.toString();
    }

    @Override
    public void onInterrupt() {
        pendingExplicitEntry = false;
        inspectionScheduled = false;
        handler.removeCallbacks(inspectRunnable);
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        hideOverlay();
        super.onDestroy();
    }
}
