function erfc (x) {
    return 1 - math.erf(x);
}

function cdfNormal (x, mean, standardDeviation) {
  return (1 - math.erf((mean - x ) / (Math.sqrt(2) * standardDeviation))) / 2
}

function cdfStdNormal (x) {
    return cdfNormal(x, 0, 1);
}

function cdfLevy (x, mu, c) {
    // CDF of levy distribution
    // https://en.wikipedia.org/wiki/L%C3%A9vy_distribution
    return erfc(math.sqrt(c / (2 * (x - mu))));
}

function cdfIGFWithMu (x, lambda, mu) {
    // CDF of the inverse Gaussian with finite mu
    // https://en.wikipedia.org/wiki/Inverse_Gaussian_distribution
    a = cdfStdNormal(
        Math.sqrt(lambda/x) * (x/mu - 1)
    );
    b = math.exp(2*lambda/mu);
    c = cdfStdNormal(
        -Math.sqrt(lambda/x) * (x/mu + 1)
    );
    // console.log("x", x, "lambda", lambda, "mu", mu, "a", a, "b", b, "c", c, "res", a+b*c);
    return a + b*c; 
}

function cdfIGF (x, lambda) {
    // when no mu is present, we assume it is infinite
    // this converges to the Levy distribution
    // https://en.wikipedia.org/wiki/Inverse_Gaussian_distribution#when_drift_is_zero

    levy_mu = 0;
    levy_c = lambda;
    return cdfLevy(x, levy_mu, levy_c);
}

function probOfPassingThresh (drift, vol, p0, K, T) {
    /*
        Starting at price p0, this computes the probability
        that a brownian motion process with given drift and
        vol will cross threshold K before T time units pass.
        In the case of hourly drift and hourly vol, T must
        be in units of hours.

        It does this by computing 

            integral over all t > 0 of pdf(first crossing at time t)
            = cdf(first crossing at time t)

        The pdf for first crossing at time t is the inverse gaussian,
        and its cdf is computed in cdfIGF.

        Returns: the actual percentage. For instance, if the probability
            is .95 of liquidation, then this function returns 95.

        Reference:
            * https://quant.stackexchange.com/a/12804
    */
    // console.log("Drift in prob of passing thresh:", drift)
    let inner = Math.log(parseFloat(K)/parseFloat(p0));
    var lambda = (inner / vol)**2
    var result;
    if (drift != 0) {
        mu = inner / drift; // OG, probably correct?
        result = cdfIGFWithMu(T, lambda, mu);
    } else {
        result = cdfIGF(T, lambda);
    }
    return result;
}