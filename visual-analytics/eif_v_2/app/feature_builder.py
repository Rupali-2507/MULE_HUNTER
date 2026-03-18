FEATURE_NAMES = [
    "transactionAmount",
    "totalIn24h",
    "totalOut24h",
    "velocityScore",
    "burstScore",
    "uniqueCounterparties7d",
    "avgAmountDeviation",
    "ja3ReuseCount",
    "deviceReuseCount",
    "ipReuseCount",
    "geoMismatch"
]


def build_feature_vector(req):

    b = req.behaviorFeatures
    i = req.identityFeatures
    n = req.networkFeatures

    fan_out_risk = b.uniqueCounterparties7d * b.velocityScore

    return [
        req.transactionAmount,        # transaction magnitude
        b.velocityScore,              # abnormal activity speed
        b.burstScore,                 # sudden burst behavior
        b.uniqueCounterparties7d,     # spreading to many accounts
        fan_out_risk,                 # laundering spread pattern
        i.deviceReuseCount,           # shared device infrastructure
        i.ipReuseCount,               # shared IP infrastructure
        i.ja3ReuseCount,              # TLS fingerprint reuse
        n.networkRiskScore,           # fraud cluster influence
        int(i.geoMismatch)            # location anomaly
    ]