package com.mulehunter.backend.DTO;

/**
 * Step 3 — Identity Feature Vector sent to ML service.
 */
public class IdentityFeaturesDTO {

    private int     ja3ReuseCount;
    private int     deviceReuseCount;
    private int     ipReuseCount;
    private boolean geoMismatch;
    private boolean isNewDevice;
    private boolean isNewJa3;

    public IdentityFeaturesDTO() {}

    public IdentityFeaturesDTO(int ja3ReuseCount, int deviceReuseCount, int ipReuseCount,
                                boolean geoMismatch, boolean isNewDevice, boolean isNewJa3) {
        this.ja3ReuseCount    = ja3ReuseCount;
        this.deviceReuseCount = deviceReuseCount;
        this.ipReuseCount     = ipReuseCount;
        this.geoMismatch      = geoMismatch;
        this.isNewDevice      = isNewDevice;
        this.isNewJa3         = isNewJa3;
    }

    public int     getJa3ReuseCount()    { return ja3ReuseCount; }
    public int     getDeviceReuseCount() { return deviceReuseCount; }
    public int     getIpReuseCount()     { return ipReuseCount; }
    public boolean isGeoMismatch()       { return geoMismatch; }
    public boolean isNewDevice()         { return isNewDevice; }
    public boolean isNewJa3()            { return isNewJa3; }
}