const api = {
  base: "https://api.dydx.exchange"
}

/*
    Global Variables
*/

var currencyFormatter = new Intl.NumberFormat('en-US', 
{
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
});
// comes from v3/markets.maintenanceMarginFraction
// curl -X GET https://api.dydx.exchange/v3/markets | jq '.markets | map_values( .maintenanceMarginFraction )'
maintenanceMarginRequirements = JSON.parse(`{
  "BTC-USD": "0.03",
  "SUSHI-USD": "0.05",
  "AVAX-USD": "0.05",
  "1INCH-USD": "0.05",
  "ETH-USD": "0.03",
  "XMR-USD": "0.05",
  "COMP-USD": "0.05",
  "ALGO-USD": "0.05",
  "BCH-USD": "0.05",
  "CRV-USD": "0.05",
  "UNI-USD": "0.05",
  "MKR-USD": "0.05",
  "LTC-USD": "0.05",
  "EOS-USD": "0.05",
  "DOGE-USD": "0.05",
  "ATOM-USD": "0.05",
  "ZRX-USD": "0.05",
  "SOL-USD": "0.05",
  "UMA-USD": "0.05",
  "AAVE-USD": "0.05",
  "ADA-USD": "0.05",
  "SNX-USD": "0.05",
  "FIL-USD": "0.05",
  "ZEC-USD": "0.05",
  "YFI-USD": "0.05",
  "LINK-USD": "0.05",
  "DOT-USD": "0.05",
  "MATIC-USD": "0.05"
}`)
var globalMetrics = {} // {product1: {updateTime: _, metric1: val, metric2: val, ...}, product2: {...}, ...}
var myCharts = {};

/*
    Asset Dropdown Info
*/

const marketDropdown = document.getElementById("assetSelect")
var markets = [];

fetch('https://api.dydx.exchange/v3/markets')
    .then(response => response.json())
    .then(function (data) {
        markets = Object.keys(data["markets"]).sort();
        markets.forEach(function (market) {
            var marketOption = document.createElement("option");
            marketOption.text = market;
            marketOption.value = market;
            marketDropdown.appendChild(marketOption);
        });
    });

marketDropdown.addEventListener("change", loadData)

function initializeProgress() {
    var progressBarDiv = document.getElementById("progressBarDiv");
    progressBarDiv.innerHTML = `
        <progress class="progress is-medium is-primary" id="progressBar" max="100" value="0">0%</progress>
    `;
    document.getElementById("statusBarContainer").style.display = 'block';
}

function incrementProgress(amount) {
    var progBar = document.getElementById("progressBar");
    progBar.value += amount;
    return;
}

function removeProgress() {
    document.getElementById("statusBarContainer").style.display = 'none';
    document.getElementById("progressBarDiv").innerHTML = "" 
}

function canGetCurrentProduct() {
    // note: change if I get rid of default
    return (marketDropdown.value != '');
}

function getCurrentProduct() {
    // note: change if I get rid of default
    return marketDropdown.value;
}

async function loadData(evt) {
    // clean up previous table state
    stopDisplayingPostCoinSelectionInfo();

    if (canGetCurrentProduct()) {
        const daysPrev = 30;
        let from = Date.now() - daysPrev*24*60*60*1000;
        
        var product = getCurrentProduct();

        initializeProgress() // start showing progress
        
        // var funding_rate_data = await getFundingRates(assetName, from);
        var [candles, funding_rate_data, curPrice] = await Promise.all([
            getCandles(product, from, .5),
            getFundingRates(product, from, .5),
            getCurPrice(product, 0)
        ])
        funding_rate_data.rename({mapper: {effectiveAt: "startedAt"}, inplace: true});
        
        var p = dfd.merge({left: candles, right: funding_rate_data, on: ['startedAt']})//.set_index({column: 'startedAt'});

        // Construct table
        removeProgress() // turn off progress message while table is being loaded

        const tableBody = document.getElementById("tableBody");
        const lookbackHours = [1, 2, 7, 30]
            .map(n => 24*n)
        
        var metrics_single_asset = {}
        lookbackHours.forEach(
            lookbackHour => {
                metrics_single_asset[lookbackHour] = createMetrics(p, lookbackHour)
        });
        globalMetrics[product] = {updateTime: Date.now(), lookback_data: metrics_single_asset};
        console.log(globalMetrics[product])

        startDisplayingParameters();
        setDefaultParams(
            metrics_single_asset[24*30]["log_hourly_returns_stdev"]*((24*365)**(1/2)), 
            curPrice
        )
    }
}

async function getCandles (product, from, progressWeight) {
    /*
        progressWeight: used in progress bar for reporting percentage completed
    */
    var progressDiv = document.getElementById("progressDiv");
    const maxPullIntervalLen = 100*60*60*1000;
    var expectedNumIterations = Math.ceil((Date.now() - from) / maxPullIntervalLen);
    var allCandles = await Promise.all(
        [...Array(expectedNumIterations).keys()].map(
            function (i) {
                var sinceISO = new Date(from + i*maxPullIntervalLen).toISOString();
                var toISO = new Date(from + (i+1)*maxPullIntervalLen).toISOString();
                return fetch(
                    `${api.base}/v3/candles/${product}`+
                    `?resolution=1HOUR&fromISO=${sinceISO}&toISO=${toISO}`)
                    .then(response => {return response.json()})
                    .then(data => {
                        incrementProgress(100*progressWeight/expectedNumIterations)
                        return data['candles'].reverse();
                })
            }
        )
    );

    allCandles = allCandles.flat();

    var df = new dfd.DataFrame(allCandles);
    return df
        .loc({
            columns: ['startedAt', 'open', 'high', 'low', 'close'],
            rows: df["startedAt"].drop_duplicates({keep: "first"}).index
        },)
        .sort_values({by: 'startedAt', ascending: true, inplace: false});
}

async function getFundingRates (product, from, progressWeight) {
    // TODO: MAKE THIS LIKE THE GET CANDLES FUNCTION AND IMPROVE PROGRESS BAR

    var progressDiv = document.getElementById("progressDiv");
    const maxPullIntervalLen = 100*60*60*1000;
    var expectedNumIterations = Math.ceil((Date.now() - from) / maxPullIntervalLen);


    var allFundingRates = await Promise.all(
        [...Array(expectedNumIterations).keys()].map(
            function (i) {
                var toISO = new Date(from + (i+1)*maxPullIntervalLen).toISOString();

                return fetch(
                    `${api.base}/v3/historical-funding/${product}`+
                    `?effectiveBeforeOrAt=${toISO}`)
                    .then(response => response.json())
                    .then(data => {
                        incrementProgress(100*progressWeight/expectedNumIterations);
                        return data['historicalFunding'].reverse();
                    })
            }
        )
    );

    allFundingRates = allFundingRates.flat();

    var fundingRateData = new dfd.DataFrame(allFundingRates)
        .rename({mapper: {rate: 'start_hour_funding_rate'}})
        
    return fundingRateData.loc(
            {rows: fundingRateData['effectiveAt'].drop_duplicates().index}
        )
        .loc({columns: ['effectiveAt', 'start_hour_funding_rate']});        
}

const rolling = (func, n, arr) => {
    const iRange = [...Array(arr.length).keys()] // Array(arr.length)
    const result = iRange.map(
        function(i) {
            if (i+1 < n) {return dfd.nan;}
            const truncated = arr.slice(i-n+1, i+1)
            return func(truncated);
        }
    )
    return result
}

function getNonNull (arr) {
    return arr.filter(
        function (e, i) {
            return (e != null) && (!isNaN(e));
        }
    )
}

function sumNonNull (arr) {
    return getNonNull(arr).reduce(
        function (a, b) {return a+b;},
        0
    )
}

function avgNonNull (arr) {
    return sumNonNull(arr) / getNonNull(arr).length;
}

function stdevNonNull (arr) {
    const avgValNonNull = avgNonNull(arr);
    const nonNulls = getNonNull(arr);
    var res = 0;
    for (let i = 0; i < nonNulls.length; ++i ) {
        res += (nonNulls[i]-avgValNonNull) ** 2;
    }
    return res**(0.5) / nonNulls.length;
}

function createMetrics (p, last_n) {
    /*
    Creates metrics in the `p` table, modifying it in-place.
    */
    // add column for end-of-hour funding rate data
    p = p.tail(last_n)

    end_hour_funding_rates_data = [];
    for (let i = 1; i < p.index.length+1; i++) {
        let prev_hour_start = p['startedAt'].values[i-1];
        var start_hour_funding_rate;
        if (i == p.index.length) {
            start_hour_funding_rate = dfd.nan;
        } else {
            start_hour_funding_rate = parseFloat(p['start_hour_funding_rate'].values[i]);
        }

        end_hour_funding_rates_data.push(start_hour_funding_rate);
    }

    p.addColumn(
        {column: "end_hour_funding_rate", values: end_hour_funding_rates_data, inplace: true}
    );


    hourly_price_raw_return = rolling(
        function(arr) {return arr[1]-arr[0]},
        2,
        p["close"].values
    )
    p.addColumn(
        {column: "hourly_price_raw_return", values: hourly_price_raw_return, inplace: true}
    )
    // console.log(JSON.stringify(hourly_price_raw_return))

    hourly_funding_rate_return = p["end_hour_funding_rate"].values.map(
        function(e,i) {
            return -1 * e * p["close"].values[i]
        }
    )
    p.addColumn(
        {column: "hourly_funding_rate_return", values: hourly_funding_rate_return, inplace: true}
    )
    // console.log(JSON.stringify(hourly_funding_rate_return))


    hourly_long_return = hourly_funding_rate_return.map(
        function(e, i) {
            return e + hourly_price_raw_return[i]
        }
    )
    p.addColumn({
        column: "hourly_long_return", 
        values: hourly_long_return,
        inplace: true
    });
    // console.log(JSON.stringify(hourly_long_return))

    daily_long_return = rolling(
        function(arr) {return arr[arr.length-1]-arr[0]},
        24,
        p["close"].values
    ).map(
        function (e, i) {
            if (i % 24 == 23) {
                return e;
            } else {
                return null;
            }
        }
    );

    dailyLongReturnMean = avgNonNull(daily_long_return);
    dailyLongReturnStdev = stdevNonNull(daily_long_return);

    daily_long_pct_return = daily_long_return.map(
        function (el, i) {
            if (el == null) {
                return null;
            } else if (i == 23) {
                return 100 * el / p["open"].values[i-24]; // handle the base case for 24 hour returns
            } else {
                return 100 * el / p["close"].values[i-24];
            }
        }
    );
    // console.log(daily_long_pct_return);
    dailyLongPctReturnMean = avgNonNull(daily_long_pct_return);
    dailyLongPctReturnStdev = stdevNonNull(daily_long_pct_return);

    hourly_long_pct_return = hourly_long_return.map(
        function(e, i) {
            if (i == 0) {
                return 100 * e / p["open"].values[i];
            } else {
                return 100 * e / p["close"].values[i-1];
            }
        }
    )
    p.addColumn({
        column: "hourly_long_pct_return",
        values: hourly_long_pct_return,
        inplace: true
    })
    
    // console.log(JSON.stringify(hourly_long_pct_return))

    hourly_funding_rate_pct_return = hourly_funding_rate_return.map(
        function(e, i) {
            return 100 * e / p["open"].values[i]
        }
    )
    p.addColumn({
        column: "hourly_funding_rate_pct_return",
        values: hourly_funding_rate_pct_return,
        inplace: true
    })

    p.dropna(0, {inplace: true})
    // p.loc(
    //     {columns: ["open", "close", "hourly_price_raw_return", "hourly_funding_rate_return", "hourly_long_return", "hourly_long_pct_return"]}
    //     ).print();
    // console.log(p.loc(
    //     {columns: ["open", "close", "hourly_price_raw_return", "hourly_funding_rate_return", "hourly_long_return", "hourly_long_pct_return"]}
    //     ));


    var metrics_single_lookback = {}
    var stdev_calc = function (time_mult) {return Math.pow(time_mult, 1/2)};
    metrics_single_lookback["lookback_hours"] = last_n;
    metrics_single_lookback["lookback_days"] = Math.floor(last_n / 24);
    metrics_single_lookback["raw_long_hourly_returns_stdev"] = p["hourly_long_return"].std()
    metrics_single_lookback["raw_long_hourly_returns_mean"] = p["hourly_long_return"].mean()
    metrics_single_lookback["raw_long_hourly_returns_median"] = p["hourly_long_return"].median()
    metrics_single_lookback["raw_long_daily_returns_mean"] = dailyLongReturnMean;
    metrics_single_lookback["raw_long_daily_returns_stdev"] = dailyLongReturnStdev;
    metrics_single_lookback["raw_long_daily_vol"] = metrics_single_lookback["raw_long_hourly_returns_stdev"] * stdev_calc(24);
    metrics_single_lookback["raw_long_yearly_vol"] = metrics_single_lookback["raw_long_hourly_returns_stdev"] * stdev_calc(24*365);

    metrics_single_lookback["pct_long_hourly_returns_stdev"] = p["hourly_long_pct_return"].std()
    metrics_single_lookback["pct_long_hourly_returns_mean"] = p["hourly_long_pct_return"].mean()
    metrics_single_lookback["pct_long_hourly_returns_median"] = p["hourly_long_pct_return"].median()
    metrics_single_lookback["pct_long_daily_returns_mean"] = dailyLongPctReturnMean;
    metrics_single_lookback["pct_long_daily_returns_stdev"] = dailyLongPctReturnStdev;
    metrics_single_lookback["pct_long_funding_returns_mean"] = p["hourly_funding_rate_pct_return"].mean()
    metrics_single_lookback["pct_long_funding_returns_median"] = p["hourly_funding_rate_pct_return"].median()
    metrics_single_lookback["pct_long_daily_vol"] = metrics_single_lookback["pct_long_hourly_returns_stdev"] * stdev_calc(24)
    metrics_single_lookback["pct_long_yearly_vol"] = metrics_single_lookback["pct_long_hourly_returns_stdev"] * stdev_calc(24*365)
    metrics_single_lookback["pct_long_daily_vol_from_daily"] = metrics_single_lookback["pct_long_daily_returns_stdev"];
    metrics_single_lookback["pct_long_yearly_vol_from_daily"] = metrics_single_lookback["pct_long_daily_returns_stdev"] * stdev_calc(365);

    log_hourly_returns = p["hourly_long_pct_return"].apply((pct_ret) => Math.log(1+pct_ret/100)); // validated, this is right
    metrics_single_lookback["log_hourly_returns_mean"] = log_hourly_returns.mean();
    metrics_single_lookback["log_hourly_returns_stdev"] = log_hourly_returns.std();

    metrics_single_lookback["log_hourly_sharpe"] = metrics_single_lookback["log_hourly_returns_mean"] / metrics_single_lookback["log_hourly_returns_stdev"];
    metrics_single_lookback["log_annual_sharpe"] = metrics_single_lookback["log_hourly_returns_mean"] / metrics_single_lookback["log_hourly_returns_stdev"]*stdev_calc(24*365);

    
    return metrics_single_lookback;
}

/*
    Code for computing personal metrics
*/
// Listen for changes to parameters
[
    "positionSize", "collateral",
    "annualVolBox", "annualDriftBox",
].forEach(function (elementId) {
    document.getElementById(elementId).addEventListener("keypress", paramInputBoxKeyPress);
});


function paramInputBoxKeyPress(event) {
    if (event.key === "Enter") {
        individualMetrics();
    }
}

var advancedOptionsButton = document.getElementById("advancedOptionsButton");
advancedOptionsButton.addEventListener("click",
    function (evt) {
        const advOptions = document.getElementById("advancedOptions");
        const advOptionsArrow = document.getElementById("advancedOptionsArrow");
        if (advOptions.style.display === "none") {
            advOptions.style.display = "block";
            advOptionsArrow.classList.remove("fa-arrow-down");
            advOptionsArrow.classList.add("fa-arrow-up");
        } else {
            advOptions.style.display = "none";
            advOptionsArrow.classList.remove("fa-arrow-up");
            advOptionsArrow.classList.add("fa-arrow-down");
        }
    }
);

var personalStatsButton = document.getElementById("getPersonalStatsButton");
personalStatsButton.addEventListener("click", individualMetrics);

function destroyAllCharts () {
    for (let chartName in myCharts) {
        var chart = myCharts[chartName];
        if (chart instanceof Chart) {
            chart.destroy();
        } else {
            console.log("Tried to destroy a non-existent chart... this is unexpected behavior!")
        }
    }
}

var resultDisplayDivToggledElementIds = [
    "volParamsParentDiv",
    "liqProbBox",
    "scalarCalculationsBox"
];

function stopDisplayingPostCoinSelectionInfo () {
    destroyAllCharts();

    document.getElementById("scalarResultsTable").innerHTML = "";
    resultDisplayDivToggledElementIds.map(
        function (id) {
            document.getElementById(id).style.display = 'none'; 
        }
    )
}

function startDisplayingParameters () {
    document.getElementById("volParamsParentDiv").style.display = 'block';
}

function setDefaultParams(annualVol, initialPrice) {
    // set the volatility text box with the annualized vol calculated here
    
    // hard-coding defaults is OK
    let initialCollateral = 100;
    let initialLeverageRatio = 5;
    let initialPositionSize = initialLeverageRatio*initialCollateral*(1/initialPrice);

    document.getElementById("annualVolBox").value = annualVol.toFixed(4);
    document.getElementById("annualDriftBox").value = 0;
    document.getElementById("collateral").value = initialCollateral.toFixed(4);
    document.getElementById("positionSize").value = initialPositionSize.toFixed(4);

    let curProd = getCurrentProduct();
    let p0 = initialPrice;
    let m0 = initialCollateral;
    let M = parseFloat(maintenanceMarginRequirements[curProd]);
    let liqPrice = simpleSingleLiquidationPrice(initialPositionSize, p0,m0, M);
    document.getElementById("stopLossBox").value = (liqPrice+0.0001).toFixed(4)

    let liqPriceChangeLogPct = Math.log(liqPrice/initialPrice);
    let takeProfPrice = Math.exp(-liqPriceChangeLogPct) * initialPrice;
    document.getElementById("takeProfitBox").value = takeProfPrice.toFixed(4);

    document.getElementById("nHoursMC").value = 24;
    document.getElementById("nCarloPaths").value = 10;
}


function startDisplayingCalculationResults () {
    destroyAllCharts();

    resultDisplayDivToggledElementIds.map(
        function (id) { 
            var displayType;
            // note: this if-clause fixes an issue where setting "scalarCalculationsBox" style.display to block makes it stop being full-height
            if ((id == "scalarCalculationsBox") || (id == "liqProbBox") ) {
                displayType = 'flex';
            } else {
                displayType = 'block';
            }
            document.getElementById(id).style.display = displayType;
        }
    )
}


async function getCurPrice (product) {
    // Get current midpoint price of a product on DyDx
    return await fetch(
        `${api.base}/v3/orderbook/${product}`
    )
    .then(response => {return response.json()})
    .then(data => {
        var minAsk = parseFloat(data["asks"][0]["price"])
        var maxBid = parseFloat(data["bids"][0]["price"]);
        // console.log(`minAsk: ${minAsk}, maxBid: ${maxBid}`)
        return (minAsk + maxBid) / 2;
    })
}

function simpleSingleLiquidationPrice (s, p0, m0, M) {
    /* 
        s: current size of the person's exposure; e.g. size=4 would mean they are long 4 coins; this can be negative valued
        p0: initial price of the perpetual contract
        m0: initial margin in the DyDx account, denominated in USDC
        M: maintenance margin ratio
    */
    var n0 = s * p0 // initial notional
    var g = (n0 >= 0) ? 1 : -1;
    const d = (n0-m0) / (n0 * (1 - g*M));
    var p1 = p0*d;
    if (((s > 0) && (p1 > p0)) || ((s < 0) && (p1 < p0))) {
        alert("Leverage ratio is too high, and would be liquidated immediately. Try a smaller position size or more collateral.");
        return -1;
    } else if ((s > 0) && (p1 < 0)) {
        return -1;
    } else {
        return p1;
    }
}

function range(a, b, k) {
    var result = [];
    for (var i = a; i < b; i += k) {
        result.push(i);
    }

    return result;
}

function gradientInItems(rgbaStart, rgbaEnd, nSteps) {
    var slopes = rgbaStart.map(function (v0, i) {
        var v1 = rgbaEnd[i];
        return (v1-v0)/nSteps;
    });
    var rgbaAll = range(0, nSteps, 1).map(function (n) {
        var c = slopes.map(function(m, i) {
            var rawVal = rgbaStart[i] + n * m;
            return (i == 3) ? rawVal : parseInt(rawVal);
        });
        return `rgba(${c[0]},${c[1]},${c[2]},${c[3]})`
    });
    return rgbaAll;
}

function powCombColors (rgba0, rgba1, w, pow) {
    return rgba0.map(
        (v0, i) => { return v0*(w**pow) + rgba1[i]*(1-w**pow) }
    ).map(
        (v, i) => {
            return (i == 3) ? v : parseInt(v)
        }
    )
}

function linearCombColors (rgba0, rgba1, w) {
    return powCombColors(rgba0, rgba1, w, 1);
}

function gradientInSize(rgbaStart, rgbaEnd, minValue, maxValue, values) {
    return values.map(
        // weights
        (v, i) => {return (v-minValue) / (maxValue-minValue)}
    ).map(
        // rgba values
        (w, i) => {return linearCombColors(rgbaStart, rgbaEnd, (1-w))}
    ).map(
        // rgba encoded values
        (c) => {return `rgba(${c[0]},${c[1]},${c[2]},${c[3]})`}
    );
}

function randLineColor () {
    let color = () => parseInt(Math.random()*255);
    var minAlpha = .9;
    let alpha = () => minAlpha + (1-minAlpha)*Math.random();
    var val = `rgba(${color()},${color()},${color()},${alpha()})`;
    return val;
}

function fillInSpan (spanId, text) {
    var span = document.getElementById(spanId);
    span.innerHTML = text;
    // span.appendChild(document.createTextNode(text));
}

function getHourlyDriftParam () {
    var annualDriftEstimate = parseFloat(document.getElementById("annualDriftBox").value); // globalMetrics[product]["lookback_data"][24*7]["pct_long_hourly_returns_mean"];
    return annualDriftEstimate / (24*365);
}

function getHourlyVolParam () {
    var annualVolEstimate = parseFloat(document.getElementById("annualVolBox").value);
    return annualVolEstimate / ((24*365)**(1/2));
}

async function individualMetrics (evt) {
    if (marketDropdown.selectedIndex < 1) {
        alert("Select a market before computing liquidation stats.");
        return;
    }

    // reset state from before
    document.getElementById("scalarResultsTable").innerHTML = "";
    startDisplayingCalculationResults();

    var positionSize = parseFloat(document.getElementById("positionSize").value);
    var collateral = parseFloat(document.getElementById("collateral").value);
    var product = getCurrentProduct();
    var curPrice = await getCurPrice(product);
    var notional = positionSize*curPrice;
    var M = parseFloat(maintenanceMarginRequirements[product]);
    var simpleLiqPrice = simpleSingleLiquidationPrice(positionSize, curPrice, collateral, M);
    fillInSpan("levRatioSpan", `${(Math.abs(notional)/collateral).toFixed(2)}x`);

    var hourlyDriftEstimate = getHourlyDriftParam();
    var hourlyVolEstimate = getHourlyVolParam();

    var simpleLiqPriceMsg;
    if (simpleLiqPrice != -1) {
        simpleLiqPriceMsg = `${currencyFormatter.format(simpleLiqPrice)}`;
        simpleLiqPriceChangeMsg = `${(100*(simpleLiqPrice/curPrice - 1)).toFixed(4)}%`;

        var probLiq1d = probOfPassingThresh(
            hourlyDriftEstimate, 
            hourlyVolEstimate, 
            curPrice, 
            simpleLiqPrice,
            24
        );
        probLiq1d = (probLiq1d >= .0001) ? `${(100*probLiq1d).toFixed(2)}%` : `${(100*probLiq1d).toExponential(2)}%`;

        var probLiq7d = probOfPassingThresh(
            hourlyDriftEstimate, 
            hourlyVolEstimate, 
            curPrice, 
            simpleLiqPrice,
            7*24
        );
        probLiq7d = (probLiq7d >= .0001) ? `${(100*probLiq7d).toFixed(2)}%` : `${(100*probLiq7d).toExponential(2)}%`;

        fillInSpan("liqPriceMsgSpan", 
            `it will be liquidated if the ${product} price moves from its current price of ${currencyFormatter.format(curPrice)} to the price of ${currencyFormatter.format(simpleLiqPrice)}. ` +
            `According to our models, there is a ${probLiq1d} chance that the ${product} price will cross the liquidation point within 24 hours, ` +
            `and a ${probLiq7d} chance that it will cross the liquidation price within 7 days. ` +
            `One way to protect yourself if the price crosses the liquidation point is to place a <a href="https://help.dydx.exchange/en/articles/5108526-selecting-order-types">stop-limit order</a> with a trigger and limit price ` +
            `${ (positionSize>0) ? "above": "below"} the liquidation price.`
        );
    } else {
        simpleLiqPriceMsg = "Position Never Liquidated";
        simpleLiqPriceChangeMsg = "Position Never Liquidated";
        fillInSpan("liqPriceMsgSpan", "it alone cannot lead to a liquidation.");
    }

    console.log(globalMetrics[product])
    var monthSharpe = globalMetrics[product]["lookback_data"][24*30]["log_annual_sharpe"]
    var generalResultData = [
        ["Perpetual Price", `${currencyFormatter.format(curPrice)}`],
        ["Position Open Interest", `${currencyFormatter.format(notional)}`],
        ["Leverage Ratio", `${(Math.abs(notional)/collateral).toFixed(4)}x`],
        ["Asset Maximum Leverage Ratio", `${(1/M).toFixed(4)}x`],
        ["Asset Minimum Collateralization", `${100*M.toFixed(4)}%`],
        ["Liquidation Price", simpleLiqPriceMsg],
        ["Price Change Needed for Liquidation", simpleLiqPriceChangeMsg],
        // ["Price Change Needed for Stop-Loss", `${(100*(stopLossPrice/curPrice-1)).toFixed(4)}%`],
        // ["Price Change Needed for Take-Profit", `${(100*(takeProfitPrice/curPrice-1)).toFixed(4)}%`],
        ["Previous Month Sharpe Ratio", `${monthSharpe.toFixed(4)}`]
    ];

    const generalResultTable = document.getElementById("scalarResultsTable");
    generalResultTable.innerHTML = "";
    generalResultData.forEach( function (rowData) {
        var tableRow = document.createElement("tr");
        rowData.forEach( 
            function (tableItem){
                var tableEntry = document.createElement("td");
                tableEntry.appendChild(document.createTextNode(tableItem));
                tableRow.appendChild(tableEntry)
        });
        generalResultTable.appendChild(tableRow);
    });

    // Liquidation probability charts
    const shortTermLiqCheckHours = range(0, 24.5, 1);
    const shortTermLiqProbs = shortTermLiqCheckHours.map(
        (n_hours) => probOfPassingThresh(
            hourlyDriftEstimate, 
            hourlyVolEstimate, 
            curPrice, 
            simpleLiqPrice,
            n_hours
        ));

    var bgColor = gradientInSize([28, 188, 124, 0.8], [228, 44, 75, 0.74], 0, 1, shortTermLiqProbs);
    var ctx = document.getElementById("shortTermLiqProbChart").getContext("2d");

    function generateYAxisTickCB (allVals) {
        if (Math.max(...allVals) >= .1) {
            return ((val, index) => `${(100*val).toFixed(2)}%`);
        } else {
            return ((val, index) => `${(100*val).toExponential(2)}%`);
        }
    }

    myCharts["shortTermProbLiqChart"] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: shortTermLiqCheckHours,
            datasets: [{
                // label: 'Probability',
                data: shortTermLiqProbs,
                backgroundColor: bgColor,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Probability of Hitting Liquidation Price within Number of Hours'
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {display: true, text: 'Probability'},
                    ticks: {callback: generateYAxisTickCB(shortTermLiqProbs)}
                },
                x: {
                    title: {display: true, text: 'Hours from Now'}
                }
            }
        }
    });

    const longTermLiqCheckDays = range(1, 60, 1);
    const longTermLiqProbs = longTermLiqCheckDays.map(
        (n_days) => probOfPassingThresh(
            hourlyDriftEstimate, hourlyVolEstimate, curPrice, simpleLiqPrice, 24*n_days
        ));

    bgColor = gradientInSize([28, 188, 124, 0.8], [228, 44, 75, 0.74], 0, 1, longTermLiqProbs);
    ctx = document.getElementById("longTermLiqProbChart").getContext("2d");

    myCharts["longTermLiqProbsChart"] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: longTermLiqCheckDays,
            datasets: [{
                label: 'Probability',
                data: longTermLiqProbs,
                backgroundColor: bgColor,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Probability of Hitting Liquidation Price within Number of Days'
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {display: true, text: 'Probability'},
                    ticks: {callback: generateYAxisTickCB(longTermLiqProbs)}
                },
                x: {
                    title: {display: true, text: 'Days from Now'}
                }
            }
        }
    });

    document.getElementById("riskReport").style.display = 'block';
}

[
    "positionSize", "collateral",
    "annualDriftBox", "annualVolBox",
    "takeProfitBox", "stopLossBox",
    "nHoursMC", "nCarloPaths"
].map((mcParamId) => document.getElementById(mcParamId).addEventListener(
    "keypress",
    function (event) {
        if (event.key === "Enter") {
            runMonteCarlo(event);
        }
    }));

["getPersonalStatsButton", "runMCButton"].forEach(
    (mcButtonId) => document.getElementById(mcButtonId).addEventListener("click", runMonteCarlo)
)

async function runMonteCarlo (event) {
    // Monte Carlo Stuff
    var takeProfitPrice = parseFloat(document.getElementById("takeProfitBox").value);
    var stopLossPrice = parseFloat(document.getElementById("stopLossBox").value);
    var hourlyDriftEstimate = getHourlyDriftParam();
    var hourlyVolEstimate = getHourlyVolParam();
    var hoursMC = document.getElementById("nHoursMC").value;
    var nCarloPaths = document.getElementById("nCarloPaths").value;
    
    var positionSize = parseFloat(document.getElementById("positionSize").value);
    var collateral = parseFloat(document.getElementById("collateral").value);
    var product = getCurrentProduct();
    var curPrice = await getCurPrice(product);
    var notional = positionSize*curPrice;
    var M = parseFloat(maintenanceMarginRequirements[product]);
    var simpleLiqPrice = simpleSingleLiquidationPrice(positionSize, curPrice, collateral, M);


    var simPaths = runSims(curPrice, hourlyDriftEstimate, hourlyVolEstimate, hoursMC, nCarloPaths);


    const mcData = {
      labels: simPaths[0].map((e,i)=>i),
      datasets: simPaths.map(
        function (path, i) {
            var lineColor = randLineColor();
            return {
                label: `Path ${i}`,
                data: path,
                pointRadius: 0,
                backgroundColor: lineColor,
                borderColor: lineColor,
                borderWidth: 1
            }}
        )
    }

    mcData["datasets"].push(
    {
        label: `Take-Profit Price`,
        data: simPaths[0].map(()=>takeProfitPrice),
        pointRadius: 0,
        backgroundColor: `rgba(0, 255, 0, 1)`,
        borderColor: `rgba(0, 255, 0, 1)`,
        borderWidth: 3,
        borderDash: [5,5]
    });

    mcData["datasets"].push(
    {
        label: `Current Price`,
        data: simPaths[0].map(()=>curPrice),
        pointRadius: 0,
        backgroundColor: `rgba(0,0,255,1)`,
        borderColor: `rgba(0,0,255,1)`,
        borderWidth: 3,
        borderDash: [5,5]
    });

    mcData["datasets"].push(
    {
        label: `Stop-Loss Price`,
        data: simPaths[0].map(()=>stopLossPrice),
        pointRadius: 0,
        backgroundColor: `rgba(255,0,0,1)`,
        borderColor: `rgba(255,0,0,1)`,
        borderWidth: 3,
        borderDash: [5,5]
    });

    mcData["datasets"].push(
    {
        label: `Liquidation Price`,
        data: simPaths[0].map(()=>simpleLiqPrice),
        pointRadius: 0,
        backgroundColor: `rgba(255,0,0,1)`,
        borderColor: `rgba(255,0,0,1)`,
        borderWidth: 3,
        borderDash: [5,5],
        pointStyle: 'cross'
    });

    var scales_ = {};
    scales_ = {
        y:{
            type: 'linear',
            display: true,
            position: 'left',
            ticks: {
                beginAtZero: true,
            },
            title: {display: true, text: 'Price'}
        },
        x: {
            title: {display: true, text: 'Hours from Now'}
        }
    }

    if (Object.keys(myCharts).includes("monteCarloChart")) {
        myCharts["monteCarloChart"].destroy();
    }

    // var ctx = document.getElementById("monteCarloChart").getContext("2d");

    myCharts["monteCarloChart"] = new Chart("monteCarloChart", {
        type: 'line',
        data: mcData,
        options: {
            scales: scales_,
            plugins: {
                title: {
                    display: true,
                    text: `Simulated ${product} Price vs. Number of Hours`
                },
                legend: {
                    display: false
                }
            },
        }
    });


    // Calculate Monte-Carlo Statistics
    mcStats(simPaths, takeProfitPrice, stopLossPrice, simpleLiqPrice);
}


function isFloat(n) {
    return n === +n && n !== (n|0);
}

function mcStats(simulationPaths, takeProfitPrice, stopLossPrice, liquidationPrice) {
    const initialPrice = simulationPaths[0][0];
    const simulationInterval = simulationPaths[0].length;
    const numPaths = simulationPaths.length;

    var crossedTakeProfit;
    var crossedStopLoss;
    var crossedLiquidation;
    if (initialPrice > stopLossPrice) {
        crossedTakeProfit = ((price) => price >= takeProfitPrice);
        crossedStopLoss = ((price) => price <= stopLossPrice);
        crossedLiquidation = ((price) => price <= liquidationPrice);
    } else {
        crossedTakeProfit = ((price) => price <= takeProfitPrice);
        crossedStopLoss = ((price) => price >= stopLossPrice);
        crossedLiquidation = ((price) => price >= liquidationPrice);
    }

    var outcomes = simulationPaths.map(
        function (pricePath) {
            for (let t = 0; t < pricePath.length; ++t) {
                var price = pricePath[t];
                if (crossedTakeProfit(price)) {
                    return "profit";
                } else if (crossedStopLoss(price)) {
                    return "loss";
                } else if (crossedLiquidation(price)) {
                    return "liquidation";
                }
            }
            return pricePath[pricePath.length-1];
        }
    );

    var numTakeProfit = outcomes.filter((el) => (el === "profit")).length;
    var numStopLoss = outcomes.filter((el) => (el === "loss")).length;
    var numLiquidated = outcomes.filter((el) => (el === "liquidation")).length;

    var inPurgatory = outcomes.filter(isFloat);
    var numInPurgatory = inPurgatory.length;
    var numProfitablePurgatory = inPurgatory.filter(price => (price > initialPrice)).length;
    var numUnprofitablePurgatory = numInPurgatory - numProfitablePurgatory;

    var numProfitable = numTakeProfit + numProfitablePurgatory;
    var numUnprofitable = numStopLoss + numUnprofitablePurgatory;

    var highestEndingPrice = Math.max(...simulationPaths.map(path => path[path.length-1]));
    var lowestEndingPrice = Math.min(...simulationPaths.map(path => path[path.length-1]));


    var tableData = [
        ["Number of Paths", numPaths],
        ["Paths with a Take-Profit", `${(100*numTakeProfit/numPaths).toFixed(4)}%`],
        ["Paths with a Stop-Loss", `${(100*numStopLoss/numPaths).toFixed(4)}%`],
        ["Paths with a Liquidation", `${(100*numLiquidated/numPaths).toFixed(4)}%`],
        ["Profitable Paths", `${(100*numProfitable/numPaths).toFixed(4)}%`],
        ["Unprofitable Paths", `${(100*numUnprofitable/numPaths).toFixed(4)}%`],
        ["Highest Ending Price", `${(highestEndingPrice).toFixed(4)}`],
        ["Lowest Ending Price", `${(lowestEndingPrice).toFixed(4)}`]
    ];

    // add the metrics to the page!
    mcTableBody = document.getElementById("mcResultsTable");
    mcTableBody.innerHTML = "";
    tableData.forEach( function (rowData) {
        var tableRow = document.createElement("tr");
        for (let i = 0; i < rowData.length; ++i) {
            var tableItem = document.createElement("td");
            tableItem.appendChild(document.createTextNode(rowData[i]));
            tableRow.appendChild(tableItem);
        }
        mcTableBody.appendChild(tableRow);
    }) 
}
