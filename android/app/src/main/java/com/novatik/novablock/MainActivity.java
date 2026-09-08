package com.novatik.novablock;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.os.Bundle;
import android.provider.Settings;
import android.view.accessibility.AccessibilityManager;
import android.widget.Button;
import android.widget.TextView;

import java.util.List;

public final class MainActivity extends Activity {
    private TextView status;
    private Button enableButton;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        status = findViewById(R.id.status);
        enableButton = findViewById(R.id.enableButton);
        enableButton.setOnClickListener(view -> {
            Intent intent = new Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS);
            startActivity(intent);
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        renderStatus();
    }

    private void renderStatus() {
        boolean enabled = isProtectionEnabled();
        status.setText(enabled ? R.string.status_enabled : R.string.status_disabled);
        status.setBackgroundResource(enabled ? R.drawable.bg_status_on : R.drawable.bg_status_off);
        enableButton.setText(enabled ? R.string.manage_service : R.string.enable_service);
    }

    private boolean isProtectionEnabled() {
        AccessibilityManager manager = (AccessibilityManager) getSystemService(ACCESSIBILITY_SERVICE);
        List<AccessibilityServiceInfo> services = manager.getEnabledAccessibilityServiceList(
                AccessibilityServiceInfo.FEEDBACK_ALL_MASK);
        ComponentName expected = new ComponentName(this, ShortsAccessibilityService.class);

        for (AccessibilityServiceInfo service : services) {
            String id = service.getId();
            if (id == null) continue;
            ComponentName actual = ComponentName.unflattenFromString(id);
            if (expected.equals(actual)) return true;
        }
        return false;
    }
}
