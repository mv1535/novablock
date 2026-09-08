package com.novatik.novablock;

public final class ShortsDetectorSelfTest {
    public static void main(String[] args) {
        detectsStrongPlayerResource();
        detectsComposePlayerSignals();
        ignoresHomeShortsShelf();
        ignoresNormalWatchPage();
        detectsExplicitShortsEntry();
        System.out.println("Android ShortsDetector: 5 checks passed");
    }

    private static void detectsStrongPlayerResource() {
        ShortsDetector.NodeSnapshot root = ShortsDetector.NodeSnapshot.branch(
                ShortsDetector.NodeSnapshot.leaf(
                        "com.google.android.youtube:id/reel_watch_fragment", "", "", false));
        assert ShortsDetector.analyze(root).shortsScreen;
    }

    private static void detectsComposePlayerSignals() {
        ShortsDetector.NodeSnapshot root = ShortsDetector.NodeSnapshot.branch(
                ShortsDetector.NodeSnapshot.leaf("", "Shorts", "", false),
                ShortsDetector.NodeSnapshot.leaf("", "", "Remixer", true),
                ShortsDetector.NodeSnapshot.leaf("", "", "J’aime", true),
                ShortsDetector.NodeSnapshot.leaf("", "", "Commentaires", true));
        assert ShortsDetector.analyze(root).shortsScreen;
    }

    private static void ignoresHomeShortsShelf() {
        ShortsDetector.NodeSnapshot root = ShortsDetector.NodeSnapshot.branch(
                ShortsDetector.NodeSnapshot.leaf(
                        "com.google.android.youtube:id/reel_shelf", "Shorts", "", true));
        assert !ShortsDetector.analyze(root).shortsScreen;
    }

    private static void ignoresNormalWatchPage() {
        ShortsDetector.NodeSnapshot root = ShortsDetector.NodeSnapshot.branch(
                ShortsDetector.NodeSnapshot.leaf("", "Shorts", "", true),
                ShortsDetector.NodeSnapshot.leaf("", "", "J’aime", true),
                ShortsDetector.NodeSnapshot.leaf("", "", "Commentaires", true),
                ShortsDetector.NodeSnapshot.leaf("", "", "Partager", true));
        assert !ShortsDetector.analyze(root).shortsScreen;
    }

    private static void detectsExplicitShortsEntry() {
        ShortsDetector.NodeSnapshot entry = ShortsDetector.NodeSnapshot.leaf(
                "com.google.android.youtube:id/pivot_shorts", "Shorts", "", true);
        assert ShortsDetector.isExplicitShortsEntry(entry);
    }
}
