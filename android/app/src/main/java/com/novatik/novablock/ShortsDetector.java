package com.novatik.novablock;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Détection pure et testable, séparée des API Android. */
public final class ShortsDetector {
    private static final String[] IDS_LECTEUR_COURT = {
        "reel_watch",
        "shorts_watch",
        "reel_player",
        "shorts_player",
        "reel_pager",
        "shorts_pager",
        "shorts_video_player"
    };

    private static final String[] IDS_ENTREE_COURT = {
        "shorts_pivot",
        "pivot_shorts",
        "reel_pivot",
        "shorts_entry",
        "shorts_tab"
    };

    private ShortsDetector() {}

    public static final class NodeSnapshot {
        public final String viewId;
        public final String text;
        public final String description;
        public final boolean clickable;
        public final List<NodeSnapshot> children;

        public NodeSnapshot(
                String viewId,
                String text,
                String description,
                boolean clickable,
                List<NodeSnapshot> children) {
            this.viewId = valueOrEmpty(viewId);
            this.text = valueOrEmpty(text);
            this.description = valueOrEmpty(description);
            this.clickable = clickable;
            this.children = Collections.unmodifiableList(
                    new ArrayList<>(children == null ? Collections.emptyList() : children));
        }

        public static NodeSnapshot leaf(String viewId, String text, String description, boolean clickable) {
            return new NodeSnapshot(viewId, text, description, clickable, Collections.emptyList());
        }

        public static NodeSnapshot branch(NodeSnapshot... children) {
            List<NodeSnapshot> values = new ArrayList<>();
            if (children != null) Collections.addAll(values, children);
            return new NodeSnapshot("", "", "", false, values);
        }

        private static String valueOrEmpty(String value) {
            return value == null ? "" : value;
        }
    }

    public static final class Result {
        public final boolean shortsScreen;
        public final int confidence;
        public final String reason;

        Result(boolean shortsScreen, int confidence, String reason) {
            this.shortsScreen = shortsScreen;
            this.confidence = confidence;
            this.reason = reason;
        }
    }

    public static boolean isExplicitShortsEntry(NodeSnapshot source) {
        if (source == null) return false;
        String id = normalize(source.viewId);
        if (containsAny(id, IDS_ENTREE_COURT)) return true;

        String label = normalize(source.text + " " + source.description).trim();
        if (source.clickable && (label.equals("shorts") || label.startsWith("shorts "))) return true;

        for (NodeSnapshot child : source.children) {
            if (isExplicitShortsEntry(child)) return true;
        }
        return false;
    }

    public static Result analyze(NodeSnapshot root) {
        if (root == null) return new Result(false, 0, "no-root");
        Signals signals = new Signals();
        inspect(root, signals, 0);

        if (signals.strongPlayerId) {
            return new Result(true, 100, "player-resource-id");
        }

        // Repli pour les versions Compose de YouTube qui ne publient plus les
        // identifiants : marque Shorts + action propre au lecteur vertical +
        // au moins deux commandes vidéo. Le trio évite les faux positifs du fil.
        boolean composeScreen = signals.shortsLabel
                && (signals.remixSignal || signals.soundSignal)
                && signals.videoActions.size() >= 2;
        if (composeScreen) {
            return new Result(true, 85, "accessible-player-signals");
        }

        int confidence = (signals.shortsLabel ? 20 : 0)
                + ((signals.remixSignal || signals.soundSignal) ? 25 : 0)
                + Math.min(30, signals.videoActions.size() * 10);
        return new Result(false, confidence, "insufficient-signals");
    }

    private static void inspect(NodeSnapshot node, Signals signals, int depth) {
        if (node == null || depth > 32 || signals.visited >= 900) return;
        signals.visited += 1;

        String id = normalize(node.viewId);
        if (containsAny(id, IDS_LECTEUR_COURT)) signals.strongPlayerId = true;

        String label = normalize(node.text + " " + node.description).trim();
        if (label.equals("shorts") || label.startsWith("shorts ")) signals.shortsLabel = true;
        if (containsAny(label, new String[] {"remix", "remixer"})) signals.remixSignal = true;
        if (containsAny(label, new String[] {
                "use this sound", "utiliser ce son", "original sound", "son original"
        })) signals.soundSignal = true;

        recordAction(label, signals.videoActions, "like", "j aime");
        recordAction(label, signals.videoActions, "dislike", "je n aime pas");
        recordAction(label, signals.videoActions, "comment", "commentaire");
        recordAction(label, signals.videoActions, "share", "partager");

        for (NodeSnapshot child : node.children) inspect(child, signals, depth + 1);
    }

    private static void recordAction(String label, Set<String> actions, String english, String french) {
        if (label.contains(english) || label.contains(french)) actions.add(english);
    }

    private static boolean containsAny(String value, String[] needles) {
        for (String needle : needles) {
            if (value.contains(needle)) return true;
        }
        return false;
    }

    private static String normalize(String value) {
        String lower = value == null ? "" : value.toLowerCase(Locale.ROOT);
        String decomposed = Normalizer.normalize(lower, Normalizer.Form.NFD);
        return decomposed.replaceAll("\\p{M}+", "").replace('’', ' ').replace('\'', ' ');
    }

    private static final class Signals {
        boolean strongPlayerId;
        boolean shortsLabel;
        boolean remixSignal;
        boolean soundSignal;
        int visited;
        final Set<String> videoActions = new HashSet<>();
    }
}
