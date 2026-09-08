package com.novatik.novablock;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public final class ShortsDetectorTest {
    @Test
    public void detectsStrongPlayerResource() {
        ShortsDetector.NodeSnapshot root = ShortsDetector.NodeSnapshot.branch(
                ShortsDetector.NodeSnapshot.leaf(
                        "com.google.android.youtube:id/reel_watch_fragment", "", "", false));
        assertTrue(ShortsDetector.analyze(root).shortsScreen);
    }

    @Test
    public void detectsComposePlayerSignals() {
        ShortsDetector.NodeSnapshot root = ShortsDetector.NodeSnapshot.branch(
                ShortsDetector.NodeSnapshot.leaf("", "Shorts", "", false),
                ShortsDetector.NodeSnapshot.leaf("", "", "Remixer", true),
                ShortsDetector.NodeSnapshot.leaf("", "", "J’aime", true),
                ShortsDetector.NodeSnapshot.leaf("", "", "Commentaires", true));
        assertTrue(ShortsDetector.analyze(root).shortsScreen);
    }

    @Test
    public void ignoresHomeShelfAndNormalVideo() {
        ShortsDetector.NodeSnapshot shelf = ShortsDetector.NodeSnapshot.branch(
                ShortsDetector.NodeSnapshot.leaf(
                        "com.google.android.youtube:id/reel_shelf", "Shorts", "", true));
        ShortsDetector.NodeSnapshot normalVideo = ShortsDetector.NodeSnapshot.branch(
                ShortsDetector.NodeSnapshot.leaf("", "Shorts", "", true),
                ShortsDetector.NodeSnapshot.leaf("", "", "J’aime", true),
                ShortsDetector.NodeSnapshot.leaf("", "", "Commentaires", true),
                ShortsDetector.NodeSnapshot.leaf("", "", "Partager", true));
        assertFalse(ShortsDetector.analyze(shelf).shortsScreen);
        assertFalse(ShortsDetector.analyze(normalVideo).shortsScreen);
    }

    @Test
    public void detectsExplicitShortsTab() {
        ShortsDetector.NodeSnapshot entry = ShortsDetector.NodeSnapshot.leaf(
                "com.google.android.youtube:id/pivot_shorts", "Shorts", "", true);
        assertTrue(ShortsDetector.isExplicitShortsEntry(entry));
    }
}
