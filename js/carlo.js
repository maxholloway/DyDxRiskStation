function annualVolToHourlyVol (annualVol) {
    /*
    annualVol: a percentage, but scaled down so that 1% would be represented as 0.01
    */
    return annualVol * Math.sqrt(1 / (365*24));
}

function annualDriftToHourly (annualDrift) {
    /*
    annualDrift: a percentage, but scaled down so that 1% would be represented as 0.01
    */
    // return annualDrift / (365*24);
    return (1+annualDrift)**(1/(365*24)) - 1;
}

function standard_normal() {
    var u = 0, v = 0;
    while(u === 0) u = Math.random(); //Converting [0,1) to (0,1)
    while(v === 0) v = Math.random();
    return Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
}

function generatePath (p0, alpha, beta, T) {
    /*
    S_{t+1} = S_t * exp(alpha + beta*N(0,1)), where
    
    * S is price
    * alpha is the mean of ln(S_{t+1}/S_t)
    * beta is the stdev of ln(S_{t+1}/S_t)
    */
    var path = [p0];
    for (let i = 1; i <= T; ++i) {
        path.push(
            path[i-1] * Math.exp((alpha - (beta**2)/2) + beta*standard_normal())
        );
    }
    return path;
}

function runSims (p0, alpha, beta, T, n) {
    /*
    p0: initial price
    alpha: the drift, computed by taking the mean of hourly returns over a time period
    beta: the volatility, computed by taking the standard deviation of hourly returns over a time period
    T: number of time steps
    n: number of simulations
    
    return n price roll outs
    */
    var paths = [];
    for (let i = 0; i < n; ++i) {
        var path = generatePath(p0, alpha, beta, T);
        paths.push(path);
    }
    
    return paths;
}