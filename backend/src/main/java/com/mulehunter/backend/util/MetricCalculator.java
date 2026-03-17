package com.mulehunter.backend.util;

public class MetricCalculator {

    public static double precision(long tp, long fp) {
        return (tp + fp) == 0 ? 0 : (double) tp / (tp + fp);
    }

    public static double recall(long tp, long fn) {
        return (tp + fn) == 0 ? 0 : (double) tp / (tp + fn);
    }

    public static double f1(double precision, double recall) {
        return (precision + recall) == 0 ? 0 :
                2 * (precision * recall) / (precision + recall);
    }

    public static double accuracy(long tp, long tn, long fp, long fn) {
        long total = tp + tn + fp + fn;
        return total == 0 ? 0 : (double) (tp + tn) / total;
    }
}