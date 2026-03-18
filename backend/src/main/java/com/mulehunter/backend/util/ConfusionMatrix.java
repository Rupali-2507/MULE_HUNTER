package com.mulehunter.backend.util;

public class ConfusionMatrix {

    private long tp = 0;
    private long fp = 0;
    private long tn = 0;
    private long fn = 0;

    public void add(int predicted, int actual) {

        if (predicted == 1 && actual == 1) tp++;
        else if (predicted == 1 && actual == 0) fp++;
        else if (predicted == 0 && actual == 0) tn++;
        else if (predicted == 0 && actual == 1) fn++;
    }

    public long getTp() { return tp; }
    public long getFp() { return fp; }
    public long getTn() { return tn; }
    public long getFn() { return fn; }
}