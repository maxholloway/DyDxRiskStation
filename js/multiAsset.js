// Position Sizes & Collateral

const api = {
  base: "https://api.dydx.exchange"
}

var currencyFormatter = new Intl.NumberFormat('en-US', 
{
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 4,
    maximumFractionDigits: 4
});

var regularReportCurrencyFormatter = new Intl.NumberFormat('en-US',
{
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
});

var myCharts = {};


/// Markets
var markets = [];
var posModalCardBody = document.getElementById("posModalCardBody");
var colsPerRow = 4;

fetch('https://api.dydx.exchange/v3/markets')
    .then(response => response.json())
    .then(function (data) {
        markets = Object.keys(data["markets"]).sort();
        markets.forEach(function (market, i) {
            var rowIndex = Math.floor(i/colsPerRow);
            var rowId = `posModalColumn${rowIndex}`;
            if (i % colsPerRow == 0) {
                // create a new row of columns
                var newRow = document.createElement("div");
                newRow.classList.add("columns");
                newRow.id = rowId;
                posModalCardBody.appendChild(newRow);
            }

            var row = document.getElementById(rowId);
            var entry = document.createElement("div");
            entry.classList.add("column");
            entry.classList.add("has-text-centered");
            var entryId = `${market}PosButton`
            entry.innerHTML = `
            <button class="button is-rounded is-inverted" id=${entryId}>
                ${market}
            </button>`;
            row.appendChild(entry);

            var entryInDocument = document.getElementById(entryId);
            entryInDocument.addEventListener("click", makeToggleActive(entryId));
        });
    });

function makeToggleActive (buttonId) {
    function toggleActive () {
        var button = document.getElementById(buttonId);
        var inactiveClassType = "is-inverted";
        var activeClassType = "is-primary";
        if (button.classList.contains(inactiveClassType)) {
            button.classList.remove(inactiveClassType);
            button.classList.add(activeClassType);
        } else {
            button.classList.remove(activeClassType);
            button.classList.add(inactiveClassType);
        }
    }
    return toggleActive;
}

function removePosSizeBox(posSizeBoxParentId, buttonId) {
    resetGbmParams();
    document.getElementById(posSizeBoxParentId).remove();
    document.getElementById(buttonId).classList.remove("is-primary");
    document.getElementById(buttonId).classList.add("is-inverted");
}

function positionModalClose (event) {
    resetGbmParams();
    document.getElementById("posModal").classList.toggle("is-active");
    var isOnClass = "is-primary";
    var posSizeBoxes = document.getElementById("posSizeBoxes");
    markets.forEach(function (market, i) {
        var buttonId = `${market}PosButton`;
        var posSizeBoxParentId = `${market}posSizeBoxParent`;
        var posSizeBoxParent = document.getElementById(posSizeBoxParentId)
        if (
            (document.getElementById(buttonId).classList.contains(isOnClass)) &&
            (! posSizeBoxParent)
        ) {
            posSizeBoxParent = document.createElement("div");
            posSizeBoxParent.classList.add("tile");
            posSizeBoxParent.classList.add("is-parent");
            posSizeBoxParent.id = posSizeBoxParentId;
            posSizeBoxParent.innerHTML = `
                <div class="noBorder tile is-child has-background-light-bis box">
                    <span>
                    ${market} Position Size
                    </span>
                    <div style="display: flex;">
                        <input class="input is-rounded" type="text" id="${market}PosSizeInput" placeholder="">
                        &nbsp &nbsp
                        <button class="delete" onclick="removePosSizeBox('${posSizeBoxParentId}', '${buttonId}')"></button>
                    </div>
                    
                </div>
            `;
            posSizeBoxes.appendChild(posSizeBoxParent);
        } else if (
            (! document.getElementById(buttonId).classList.contains(isOnClass)) &&
            (posSizeBoxParent)
        )
         {
            posSizeBoxParent.remove();
        }
    })
}

function resetGbmParams() {
    document.getElementById("annualDriftBox").value = '';
    document.getElementById("annualVolBox").value = '';
}

function resetMCParams() {
    document.getElementById("nHoursMC").value = 24;
    document.getElementById("nCarloPaths").value = 100;
}

//// comes from v3/markets.maintenanceMarginFraction
//// curl -X GET https://api.dydx.exchange/v3/markets | jq '.markets | map_values( .maintenanceMarginFraction )'
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

/// Globabl Metrics
var globalMetrics = {} // {product1: {updateTime: _, metric1: val, metric2: val, ...}, product2: {...}, ...}
var myCharts = {};

/// Advanced Options Menu
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

// Generate Risk Statistics
document.getElementById("getRiskStatsButton").addEventListener("click", generateRiskStats);

class NoAssetsSelectedError extends Error {
    constructor(message) {
        super(message);
        this.name = "NoAssetsSelectedError";
    }
}

class InvalidPositionSizeError extends Error {
    constructor(message) {
        super(message);
        this.name = "InvalidPositionSizeError";
    }
}

class InsufficientEquityError extends Error {
    constructor() {
        super("There is not enough equity for the proposed initial portfolio to exist.");
        this.name = "InsufficientEquityError";
    }
}

async function verifyInput () {
    try {
        const markets = getPositions();
        const positionSizes = getPositionSizes();

        const requiredEquity = getCurrentLiquidationEquity(
            await getCurrentPrices(markets), 
            positionSizes
        );

        const initialEquity = getEquity();

        if (initialEquity < requiredEquity) {
            throw new InsufficientEquityError()
        }



    } catch (error) {
        if (error.name == "NoAssetsSelectedError") {
            alert("You must select at least one asset to continue.");
        } else if (error.name == "InvalidPositionSizeError") {
            alert(error.message);
        } else if (error instanceof InsufficientEquityError) {
            alert(error.message);
        }
        throw error;
    }
}

async function generateRiskStats (event) {
    /* 
        Handles populating the rest of the page with risk statistics 
    */

    // initial clean-up
    resetMCParams();
    document.getElementById("generatedStats").style.display = 'none';

    await verifyInput(); // block everything if the necessary user input is not present
    
    // loads historical data; computes portfolio value over time; computes collateral value over time;
    const daysPrev = 30;
    let from = Date.now() - daysPrev*24*60*60*1000;
    var positionSizes = getPositionSizes();
    var markets = Object.keys(positionSizes);
    var returnsData = await getDailyPortfolioReturns(markets, positionSizes, from, 1);

    // generates log returns mean and stdev
    var dailyDriftEstimate = getDailyDriftEstimates(returnsData);
    var dailyVolEstimate = getDailyVolEstimates(returnsData);

    // pre-populates Monte-Carlo entry box;
    setGbmParams(dailyDriftEstimate, dailyVolEstimate);
    
    // set message stats;
    await setMessage();

    // set probability of liquidation;
    await createLiqProbCharts();

    // sets general stats;
    await setGeneralStats(returnsData, positionSizes);

    // runs Monte Carlo and generates Monte Carlo graph;
    // generates Monte Carlo stats
    await runMonteCarlo();

    // plots correlation heatmap
    runCorrelations();

    // display it all
    document.getElementById("generatedStats").style.display = 'block';
}

function parseFloatSpecial (numStr) {
    try {
        return parseFloat(numStr.replace(',', '').replace('$', ''));
    } catch (error) {
        alert("Failed to parse float, please fix.")
        throw error;
    }  
}

function getPositionSizes () {
    var posSizes = {};
    getPositions().forEach(function (market) {
        var posSizeInputEl = document.getElementById(`${market}PosSizeInput`);
        if (posSizeInputEl.value == '') {
            throw new InvalidPositionSizeError("You must enter a position size for all positions.");
        } else if (posSizeInputEl.value.includes('$')) {
            throw new InvalidPositionSizeError("Positions sizes should be represented in terms of the number of coins, NOT US dollars.");
        } else {
            try {
                posSizes[market] = parseFloatSpecial(posSizeInputEl.value);
            } catch (error) {
                throw new InvalidPositionSizeError(`Error parsing position size for ${market}. Ensure that it is formatted as a  number.`);
            }
        }

        
    });

    if (Object.keys(posSizes).length == 0) {
        throw new Error();
    }

    return posSizes;
}

function getPositions () {
    var positions = [];
    markets.forEach(function (market) {
        var posSizeInputEl = document.getElementById(`${market}PosSizeInput`);
        if (posSizeInputEl) {
            positions.push(market);
        }
    });
    
    if (positions.length == 0) {
        throw new NoAssetsSelectedError();
    }

    return positions;
}

function getEquity () {
    var accountEquityEl = document.getElementById("accountEquity");
    if (accountEquityEl) {
        equityVal = parseFloatSpecial(accountEquityEl.value);
        if (equityVal <= 0) {
            alert("Account equity must be greater than 0.");
            throw new Error();
        } else {
            return equityVal;
        }
    } else {
        alert("Enter a value for account equity!");
        throw new Error();
    }
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

async function getDailyPortfolioReturns (markets, positionSizes, from, progressWeight) {
    const nMarkets = markets.length;
    dailyReturnsDfs = await Promise.all(
        markets.map(market => getDailyReturnsSingleMarket(market, from, progressWeight/nMarkets))
    );

    var portfolioRawRets  = dailyReturnsDfs[0]["daily_raw_return"].mul(positionSizes[markets[0]]); // raw return at end of time t
    var portfolioOpenInt  = dailyReturnsDfs[0]["open"]            .mul(Math.abs(positionSizes[markets[0]])); // port value at beg of time t
    for (let i = 1; i < dailyReturnsDfs.length; ++i) {
        portfolioRawRets = portfolioRawRets.add(dailyReturnsDfs[i]["daily_raw_return"].mul(positionSizes[markets[i]]));
        portfolioOpenInt = portfolioOpenInt.add(dailyReturnsDfs[i]["open"].mul(Math.abs(positionSizes[markets[i]]) ));
    }
    var portfolioPropRets = portfolioRawRets.div(portfolioOpenInt);
    var portfolioLogRets = portfolioPropRets.map(return_prop => Math.log(1 + return_prop));
    
    return {
        "portfolioRawRets": portfolioRawRets,
        "portfolioOpenInt": portfolioOpenInt,
        "portfolioPropRets": portfolioPropRets,
        "portfolioLogRets": portfolioLogRets
    }

}

async function getDailyReturnsSingleMarket (market, from, progressWeight) {
    /*
        progressWeight: used in progress bar for reporting percentage completed
    */

    const maxPullIntervalLen = 100*24*60*60*1000; // in milliseconds
    var expectedNumIterations = Math.ceil((Date.now() - from) / maxPullIntervalLen);
    var allCandles = await Promise.all(
        [...Array(expectedNumIterations).keys()].map(
            function (i) {
                var sinceISO = new Date(from + i*maxPullIntervalLen).toISOString();
                var toISO = new Date(from + (i+1)*maxPullIntervalLen).toISOString();
                return fetch(
                    `${api.base}/v3/candles/${market}`+
                    `?resolution=1DAY&fromISO=${sinceISO}&toISO=${toISO}`)
                    .then(response => {return response.json()})
                    .then(data => {
                        return data['candles'].reverse();
                })
            })
    );

    allCandles = allCandles.flat();

    var df = new dfd.DataFrame(allCandles);
    df = df.loc({rows: df["startedAt"].drop_duplicates({keep: "first"}).index})
        .sort_values({by: 'startedAt', ascending: true, inplace: false});

    daily_raw_return = rolling(
        (arr) => arr[1]-arr[0],
        2,
        df["close"].values
    );
    df.addColumn(
        {column: "daily_raw_return", values: daily_raw_return, inplace: true}
    )

    daily_proportion_return = rolling(
        (arr) => arr[1]/arr[0] - 1,
        2,
        df["close"].values
    );
    df.addColumn(
        {column: "daily_proportion_return", values: daily_proportion_return, inplace: true}
    )
    

    daily_log_return = daily_proportion_return.map(proportion_return => Math.log(1+proportion_return));
    df.addColumn(
        {column: "daily_log_return", values: daily_log_return, inplace: true}
    )

    return df.dropna(0).loc({columns: ['startedAt', 'open', 'close', 'daily_raw_return', 'daily_proportion_return', 'daily_log_return']})
}

async function getCurrentPrices (markets) {
    var priceArr = await Promise.all(
        markets.map(market => getCurrentPrice(market))
    );

    var curPrices = {};
    priceArr.forEach((price, i) => curPrices[markets[i]] = price);

    return curPrices;
}

async function getCurrentPrice (market) {
    // Get current midpoint price of a market on DyDx
    return await fetch(
        `${api.base}/v3/orderbook/${market}`
    )
    .then(response => {return response.json()})
    .then(data => {
        var minAsk = parseFloat(data["asks"][0]["price"])
        var maxBid = parseFloat(data["bids"][0]["price"]);
        return (minAsk + maxBid) / 2;
    })
}

async function correlationStatistics (evt) {
    // note: this relies on markets being defined, which comes through an async call
    const daysPrev = 30;
    let from = Date.now() - daysPrev*24*60*60*1000;

    var subMarkets = markets;
    var allLogReturns = await Promise.all(
        subMarkets.map(function (market) {
            return getDailyReturns(market, from, 1/subMarkets.length)
        })
    );
    
    function std (r) {
        var mean = r.mean();
        var devs = r.apply((val) => (val - mean)**2);
        return Math.sqrt(devs.sum() / devs.values.length);
    }

    function cov (r1, r2) {
        let [r1mean, r2mean] = [r1.mean(), r2.mean()];
        let [r1err, r2err] = [r1.sub(r1mean), r2.sub(r2mean)];
        return r1err.mul(r2err).mean();
    }

    function corr (r1, r2) {
        let [sigma1, sigma2] = [std(r1), std(r2)];
        return cov(r1, r2) / (sigma1*sigma2);
    }

    var cov_ = allLogReturns.map(function (df1) {
        return allLogReturns.map(function (df2) {
            return cov(df1["hourly_price_log_return"], df2["hourly_price_log_return"]);
        })
    });

    var corr_ = allLogReturns.map(function (df1) {
        return allLogReturns.map(function (df2) {
            return corr(df1["hourly_price_log_return"], df2["hourly_price_log_return"]);
        })
    });

    graphCorrelationStats(corr_, subMarkets, -1, 1);
}

function parseDailyDriftEstimates () {
    return parseFloatSpecial(document.getElementById("annualDriftBox").value) / (365);
}

function parseDailyVolEstimates () {
    return parseFloatSpecial(document.getElementById("annualVolBox").value) / ((365)**(1/2));
}

function getDailyDriftEstimates (returnsData) {
    return returnsData["portfolioLogRets"].mean();
}

function getDailyVolEstimates (returnsData) {
    return returnsData["portfolioLogRets"].std();
}

function fillInSpan (spanId, text) {
    var span = document.getElementById(spanId);
    span.innerHTML = text;
}

function getCurrentOpenInterest (curPrices, positionSizes) {
    var oi = 0;
    Object.keys(curPrices).forEach(mkt => oi += Math.abs(positionSizes[mkt])*curPrices[mkt]);
    return oi;
}

function getCurrentLiquidationEquity (curPrices, positionSizes) {
    var maintenanceMarginRequired = 0;
    Object.keys(curPrices).forEach(
        (mkt) => maintenanceMarginRequired += Math.abs(positionSizes[mkt])*curPrices[mkt]*maintenanceMarginRequirements[mkt]
    );
    return maintenanceMarginRequired;
}

function getBeta (curPrices, positionSizes) {
    /*
        A measure of the net exposure that we have to crypto.
        This is given by (sum of directional open interest) / (sum of absolute open interest).

        This can be used as an approximate stand-in for how much an account's open interest
        will change when the portfolio's positions change. That formula would be 
                I_t = I_{t-1} + beta * (V_{t} - V_{t-1}),
        where I is the account open interest and `V_t - V_{t-1}` is the change in the equity
        account value. The idea here is that when there is no change in underlying equity
        account value, there will be roughly no change in the open interest. However if there
        is a large change in the equity account value, and we are really positively exposed,
        then we can gather that there is probably some increase in the open interest;
        similarly, if we're really short, then we would expect that an increase in equity
        account value correspond to a decrease in the open interest tracked.
    */

    var absoluteOI = 0;
    Object.keys(curPrices).forEach(mkt => absoluteOI += Math.abs(positionSizes[mkt])*curPrices[mkt]);

    var directionalOI = 0;
    Object.keys(curPrices).forEach(mkt => directionalOI += positionSizes[mkt]*curPrices[mkt]);
    
    return directionalOI / absoluteOI;
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

function setHealthScore (probLiquidation) {
    const w = probLiquidation;
    const c = linearCombColors([28, 188, 124, 0.8], [228, 44, 75, 0.74], (1-w));
    const healthColor = `rgba(${c[0]},${c[1]},${c[2]},${c[3]})`;

    document.getElementById("healthScoreTitle").style.color = healthColor;
    var healthScoreValueEl = document.getElementById("healthScoreValue");
    healthScoreValueEl.style.color = healthColor;
    healthScoreValueEl.innerHTML = `${(100*(1-probLiquidation)).toFixed(0)} / 100`;

    var healthBar = document.getElementById("healthBar");

    var prescriptionMessage;
    if (probLiquidation > .9) {
        prescriptionMessage = "This portfolio is in imminent danger of liquidation. Practice proper risk management by placing stop limit orders and monitoring your positions.";
    } else if (probLiquidation > .7) {
        prescriptionMessage = "This portfolio has a high probability of liquidation. Practice proper risk management by placing stop limit orders and monitoring your positions.";
    } else if (probLiquidation > .05) {
        prescriptionMessage = "This portfolio has a medium probability of liquidation. Practice proper risk management by placing stop limit orders and monitoring your positions.";
    } else {
        prescriptionMessage = "This position is fairly safe. Still practice proper risk management by placing stop limit orders and monitoring your positions.";
    }
    const prescriptionText = document.createTextNode(prescriptionMessage);
    var perscriptionEl = document.getElementById("prescription");
    perscriptionEl.innerHTML = "";
    perscriptionEl.appendChild(prescriptionText);
    perscriptionEl.style.color = healthColor;
}

async function setMessage () {
    const dailyDriftEstimate = parseDailyDriftEstimates();
    const dailyVolEstimate = parseDailyVolEstimates();

    const positionSizes = getPositionSizes();
    const positionMarkets = Object.keys(positionSizes);
    const curPrices = await getCurrentPrices(positionMarkets);
    
    const initialOI = getCurrentOpenInterest(curPrices, positionSizes);
    fillInSpan("openInterestSpan", `${regularReportCurrencyFormatter.format(initialOI)}`);

    const initialEquity = getEquity();
    fillInSpan("equitySpan", `${regularReportCurrencyFormatter.format(initialEquity)}`);
    
    const curMinEquity = getCurrentLiquidationEquity(curPrices, positionSizes)
    fillInSpan("collatReq", `${regularReportCurrencyFormatter.format(curMinEquity)}`);

    const beta = getBeta(curPrices, positionSizes);
    const m_avg = curMinEquity/initialOI;

    const v0 = initialOI;
    const v_liq_approx = ((m_avg*initialOI - initialEquity) / (1 - m_avg*beta)) + v0;
    const e_liq_approx = initialEquity + (v_liq_approx - v0);

    var probLiq1Day;
    var probLiq7Day;
    if (e_liq_approx <= 0) {
        probLiq1Day = 0;
        probLiq7Day = 0;
    } else {
        probLiq1Day = probOfPassingThresh (dailyDriftEstimate, dailyVolEstimate, v0, v_liq_approx, 1);
        probLiq7Day = probOfPassingThresh (dailyDriftEstimate, dailyVolEstimate, v0, v_liq_approx, 7);
    }

    if (Number.isNaN(probLiq1Day)) {
        probLiq1Day = 0;
    }

    if (Number.isNaN(probLiq7Day)) {
        probLiq7Day = 0;
    }

    fillInSpan("probLiq1Day", `${(100*probLiq1Day).toFixed(4)}%`);
    fillInSpan("probLiq7Day", `${(100*probLiq7Day).toFixed(4)}%`);

    setHealthScore(probLiq7Day);
}

function range(a, b, k) {
    var result = [];
    for (var i = a; i < b; i += k) {
        result.push(i);
    }

    return result;
}

function estimateLiquidationV (curPrices, positionSizes) {
    /* 
        Uses the beta calculation to estimate the minimum equity that will lead to a liquidation.
        Here's how it goes:
            1: I_f - I_0 = beta * (V_f - V_0)   // approximate change in open interest wrt change in brownian motion term V
            2: E_f - E_0 = V_f - V_0            // change in equity with change in brownian motion term V
            3: E_f = M_avg I_f                  // approximate liquidation condition
            4: M_avg = (current min eq) / OI    // approximation of a portfolio-wide minimum margin requirement

        These all combine to produce a value for E_f, the liquidation equity.
    */
    const initialEquity = getEquity();
    const curMinEquity = getCurrentLiquidationEquity(curPrices, positionSizes);
    const beta = getBeta(curPrices, positionSizes);

    const initialOI = getCurrentOpenInterest(curPrices, positionSizes);
    const m_avg = curMinEquity/initialOI;

    const v0 = initialOI;
    const vLiqApprox = ((m_avg*initialOI - initialEquity) / (1 - m_avg*beta)) + v0;
    return vLiqApprox;
}

function estimateLiquidationEquity (curPrices, positionSizes) {
    const initialEquity = getEquity();
    const initialOI = getCurrentOpenInterest(curPrices, positionSizes);
    const vLiqApprox = estimateLiquidationV(curPrices, positionSizes);

    return initialEquity + (vLiqApprox - initialOI);
}

async function createLiqProbCharts () {
    const dailyDriftEstimate = parseDailyDriftEstimates();
    const dailyVolEstimate = parseDailyVolEstimates();
    const positionSizes = getPositionSizes();
    const positionMarkets = Object.keys(positionSizes);
    const curPrices = await getCurrentPrices(positionMarkets);
    const v0 = getCurrentOpenInterest(curPrices, positionSizes);
    const vLiqApprox = estimateLiquidationV(curPrices, positionSizes);
    
    const shortTermLiqCheckHours = range(0, 24.5, 1);
    const shortTermLiqProbs = shortTermLiqCheckHours.map(
        (nHours) => probOfPassingThresh(dailyDriftEstimate, dailyVolEstimate, v0, vLiqApprox, nHours/24)
    );

    const longTermLiqCheckDays = range(1, 60, 2);
    const longTermLiqProbs = longTermLiqCheckDays.map(
        (nDays) => probOfPassingThresh(
            dailyDriftEstimate, dailyVolEstimate, v0, vLiqApprox, nDays
        ));


    var bgColor = gradientInSize([28, 188, 124, 0.8], [228, 44, 75, 0.74], 0, 1, shortTermLiqProbs);
    
    if ("shortTermLiqProbChart" in myCharts) {
        myCharts["shortTermLiqProbChart"].destroy();
        delete myCharts["shortTermLiqProbChart"];
    }
    var ctx = document.getElementById("shortTermLiqProbChart").getContext("2d");

    function generateYAxisTickCB (allVals) {
        if (Math.max(...allVals) >= .1) {
            return ((val, index) => `${(100*val).toFixed(2)}%`);
        } else {
            return ((val, index) => `${(100*val).toExponential(2)}%`);
        }
    }

    myCharts["shortTermLiqProbChart"] = new Chart(ctx, {
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
                    text: 'Probability of Getting Liquidated within Number of Hours'
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

    bgColor = gradientInSize([28, 188, 124, 0.8], [228, 44, 75, 0.74], 0, 1, longTermLiqProbs);
    ctx = document.getElementById("longTermLiqProbChart").getContext("2d");

    if ("longTermLiqProbChart" in myCharts) {
        myCharts["longTermLiqProbChart"].destroy();
        delete myCharts["longTermLiqProbChart"];
    }
    myCharts["longTermLiqProbChart"] = new Chart(ctx, {
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
}

async function setGeneralStats (returnsData, positionSizes) {
    const positions = Object.keys(positionSizes);
    const curPrices = await getCurrentPrices(positions);

    // portfolio open interest
    const initialOI = getCurrentOpenInterest(curPrices, positionSizes);

    // portfolio equity
    const initialEquity = getEquity();

    // portfolio collateralization ratio
    const collatRatio = initialEquity / initialOI;

    // portfolio minimum collateralization
    const curMinEquity = getCurrentLiquidationEquity(curPrices, positionSizes);
    
    // portfolio leverage ratio
    const levRatio = 1 / collatRatio;

    // portfolio net crypto exposure
    const beta = getBeta(curPrices, positionSizes);
    const exposureLev = beta*levRatio;              // (net_OI/abs_OI) * (abs_OI/equity)
    const rawExposure = exposureLev*initialEquity;  // (net_OI/abs_OI) * (abs_OI/equity) * (equity)


    // portfolio estimated liquidation equity
    const estimatedMinEquity = estimateLiquidationEquity(curPrices, positionSizes);

    // portfolio 30-day annualized log return
    const annualizedDrift = getDailyDriftEstimates(returnsData) * 365;

    // portfolio 30-day annualized volatility
    const annualizedVol = getDailyVolEstimates(returnsData) * Math.sqrt(365);

    // portfolio 30-day annualized sharpe
    const annualizedSharpe = annualizedDrift / annualizedVol;

    // portfolio 30-day annualized pct return
    const annualizedPctReturn = 100*(Math.exp(annualizedDrift) - 1);

    // synthesize table
    const tableData = [
        ["Account Open Interest", `${regularReportCurrencyFormatter.format(initialOI)}`],
        ["Account Equity", `${regularReportCurrencyFormatter.format(initialEquity)}`],
        ["Collateralization Ratio", `${collatRatio.toFixed(4)}`],
        ["Portfolio Minimum Equity", `${regularReportCurrencyFormatter.format(curMinEquity)}`],
        ["Crypto Net Exposure", `${regularReportCurrencyFormatter.format(Math.abs(rawExposure))} ${(rawExposure > 0) ? 'Long' : 'Short'}`],
        ["Crypto Net Leverage", `${Math.abs(exposureLev).toFixed(4)}x ${(exposureLev > 0) ? 'Long' : 'Short'}`],
        ["Leverage Ratio", `${levRatio.toFixed()}`],
        ["Annualized 30 day Volatility", `${annualizedVol.toFixed(4)}`],
        ["Annualized 30 day Sharpe Ratio", `${annualizedSharpe.toFixed(4)}`]
    ];

    const generalResultTable = document.getElementById("scalarResultsTable");
    generalResultTable.innerHTML = "";
    tableData.forEach( function (rowData) {
        var tableRow = document.createElement("tr");
        rowData.forEach( 
            function (tableItem){
                var tableEntry = document.createElement("td");
                tableEntry.appendChild(document.createTextNode(tableItem));
                tableRow.appendChild(tableEntry)
        });
        generalResultTable.appendChild(tableRow);
    });

    // portfolio 30-day drop from all-time-high
}

function setGbmParams (dailyDriftEstimate, dailyVolEstimate) {
    if (document.getElementById("annualDriftBox").value == '') {
        document.getElementById("annualDriftBox").value = 0;
    }

    if (document.getElementById("annualVolBox").value == '') {
     document.getElementById("annualVolBox").value = dailyVolEstimate * (365**(1/2));
    }
}

function getHourlyDriftParam () {
    var annualDriftEstimate = parseFloatSpecial(document.getElementById("annualDriftBox").value); // globalMetrics[product]["lookback_data"][24*7]["pct_long_hourly_returns_mean"];
    return annualDriftEstimate / (24*365);
}

function getHourlyVolParam () {
    var annualVolEstimate = parseFloatSpecial(document.getElementById("annualVolBox").value);
    return annualVolEstimate / ((24*365)**(1/2));
}

function getNumHours () {
    const nHours = parseFloatSpecial(document.getElementById("nHoursMC").value);
    if (nHours > 24*60) {
        alert(`Number of Monte Carlo hours must be less than or equal to ${24*360}.`);
    }
    return nHours;
}

function getNumPaths () {
    const nPaths = parseInt(parseFloatSpecial(document.getElementById("nCarloPaths").value));
    if (nPaths > 1000) {
        alert("Number of Monte Carlo paths must be less than or equal to 1000.");
        throw new Error();
    }
    return nPaths;
}

function randLineColor () {
    let color = () => parseInt(Math.random()*255);
    var minAlpha = .9;
    let alpha = () => minAlpha + (1-minAlpha)*Math.random();
    var val = `rgba(${color()},${color()},${color()},${alpha()})`;
    return val;
}

async function runMonteCarlo () {
    // show that it's loading
    var runMonteCarloButton = document.getElementById("runMCButton");
    runMonteCarloButton.classList.toggle("is-loading");

    // collect input parameters
    const hourlyDrift = getHourlyDriftParam();
    const hourlyVol = getHourlyVolParam();
    const numHours = getNumHours();
    const numPaths = getNumPaths();

    const positionSizes = getPositionSizes();
    const curPrices = await getCurrentPrices(Object.keys(positionSizes));
    const initialOI = getCurrentOpenInterest(curPrices, positionSizes);
    const initialEquity = getEquity();
    const beta = await getBeta(curPrices, positionSizes); // see docstring for explanation
    const approxLiqEq = estimateLiquidationEquity(curPrices, positionSizes);

    var simPaths = runSims(initialOI, hourlyDrift, hourlyVol, numHours, numPaths);

    var equitySimPaths = simPaths.map(function (path) {
        var equityValues = [initialEquity];
        for (let t = 1; t < path.length; ++t) {
            equityValues.push(parseFloat(equityValues[t-1]) + parseFloat(path[t]-path[t-1]) );
        }
        return equityValues;
    });

    var oiSimPaths = simPaths.map(function (path) {
        var oiValues = [initialOI];
        for (let t = 0; t < path.length; ++t) {
            oiValues.push(oiValues[t-1] + beta*path[t])
        }
        return oiValues;
    })

    const mcData = {
      labels: equitySimPaths[0].map((e,i)=>i),
      datasets: equitySimPaths.map(
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
        label: `Initial Equity`,
        data: equitySimPaths[0].map(()=>initialEquity),
        pointRadius: 0,
        backgroundColor: `rgba(0,0,255,1)`,
        borderColor: `rgba(0,0,255,1)`,
        borderWidth: 3,
        borderDash: [5,5]
    });

    mcData["datasets"].push(
    {
        label: `Approximate Liquidation Equity`,
        data: equitySimPaths[0].map(()=>approxLiqEq),
        pointRadius: 0,
        backgroundColor: `rgba(255,0,0,1)`,
        borderColor: `rgba(255,0,0,1)`,
        borderWidth: 3,
        borderDash: [5,5]
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
            title: {display: true, text: 'Equity Value'}
        },
        x: {
            title: {display: true, text: 'Hours from Now'}
        }
    }

    if (Object.keys(myCharts).includes("monteCarloChart")) {
        myCharts["monteCarloChart"].destroy();
    }

    myCharts["monteCarloChart"] = new Chart("monteCarloChart", {
        type: 'line',
        data: mcData,
        options: {
            scales: scales_,
            plugins: {
                title: {
                    display: true,
                    text: `Simulated Equity Value vs. Number of Hours`
                },
                legend: {
                    display: false
                }
            },
        }
    });

    mcStats(equitySimPaths, approxLiqEq);

    // stop loading monte carlo button
    runMonteCarloButton.classList.toggle("is-loading");
}

function isFloat(n) {
    // from Stack Overflow
    return n === +n && n !== (n|0);
}

function mcStats(simulationPaths, liqEq) {
    const initialEq = simulationPaths[0][0];
    const simulationInterval = simulationPaths[0].length;
    const numPaths = simulationPaths.length;

    var crossedLiquidation = ((equity) => equity <= liqEq);

    var outcomes = simulationPaths.map(
        function (pricePath) {
            for (let t = 0; t < pricePath.length; ++t) {
                var price = pricePath[t];
                if (crossedLiquidation(price)) {
                    return "liquidation";
                }
            }
            return pricePath[pricePath.length-1];
        }
    );

    var numLiquidated = outcomes.filter((el) => (el === "liquidation")).length;

    var inPurgatory = outcomes.filter(isFloat);
    var numInPurgatory = inPurgatory.length;

    var numProfitable = inPurgatory.filter(eq => (eq > initialEq)).length;
    var numUnprofitable = numLiquidated + (numInPurgatory - numProfitable);

    var highestEndingEq = Math.max(...simulationPaths.map(path => path[path.length-1]));
    var lowestEndingEq = Math.min(...simulationPaths.map(path => path[path.length-1]));


    var tableData = [
        ["Number of Paths", numPaths],
        ["Paths with a Liquidation", `${(100*numLiquidated/numPaths).toFixed(4)}%`],
        ["Profitable Paths", `${(100*numProfitable/numPaths).toFixed(4)}%`],
        ["Unprofitable Paths", `${(100*numUnprofitable/numPaths).toFixed(4)}%`],
        ["Highest Ending Equity", `${(highestEndingEq).toFixed(4)}`],
        ["Lowest Ending Equity", `${Math.max(0, lowestEndingEq).toFixed(4)}`]
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

async function runCorrelations (evt) {
    // note: this relies on markets being defined, which comes through an async call
    const daysPrev = 30;
    let from = Date.now() - daysPrev*24*60*60*1000;

    var subMarkets = getPositions();
    var allLogReturns = await Promise.all(
        subMarkets.map(function (market) {
            return getLogReturnsDaily(market, from, 1/subMarkets.length)
        })
    );
    
    function std (r) {
        var mean = r.mean();
        var devs = r.apply((val) => (val - mean)**2);
        return Math.sqrt(devs.sum() / devs.values.length);
    }

    function cov (r1, r2) {
        let [r1mean, r2mean] = [r1.mean(), r2.mean()];
        let [r1err, r2err] = [r1.sub(r1mean), r2.sub(r2mean)];
        return r1err.mul(r2err).mean();
    }

    function corr (r1, r2) {
        let [sigma1, sigma2] = [std(r1), std(r2)];
        return cov(r1, r2) / (sigma1*sigma2);
    }

    var cov_ = allLogReturns.map(function (df1) {
        return allLogReturns.map(function (df2) {
            return cov(df1["hourly_log_return"], df2["hourly_log_return"]);
        })
    });

    var corr_ = allLogReturns.map(function (df1) {
        return allLogReturns.map(function (df2) {
            return corr(df1["hourly_log_return"], df2["hourly_log_return"]);
        })
    });

    graphCorrelationStats(corr_, subMarkets, -1, 1);
}

async function getLogReturnsDaily (product, from, progressWeight) {
    /*
        progressWeight: used in progress bar for reporting percentage completed
    */

    const maxPullIntervalLen = 100*24*60*60*1000; // in milliseconds
    var expectedNumIterations = Math.ceil((Date.now() - from) / maxPullIntervalLen);
    var allCandles = await Promise.all(
        [...Array(expectedNumIterations).keys()].map(
            function (i) {
                var sinceISO = new Date(from + i*maxPullIntervalLen).toISOString();
                var toISO = new Date(from + (i+1)*maxPullIntervalLen).toISOString();
                return fetch(
                    `${api.base}/v3/candles/${product}`+
                    `?resolution=1DAY&fromISO=${sinceISO}&toISO=${toISO}`)
                    .then(response => {return response.json()})
                    .then(data => {
                        // incrementProgress(100*progressWeight/expectedNumIterations)
                        return data['candles'].reverse();
                })
            })
    );

    allCandles = allCandles.flat();

    var df = new dfd.DataFrame(allCandles);
    df = df.loc({rows: df["startedAt"].drop_duplicates({keep: "first"}).index})
        .sort_values({by: 'startedAt', ascending: true, inplace: false});

    hourly_proportion_return = rolling(
        (arr) => arr[1]/arr[0] - 1,
        2,
        df["close"].values
    )

    df.addColumn(
        {column: "hourly_proportion_return", values: hourly_proportion_return, inplace: true}
    )
    

    hourly_log_return = hourly_proportion_return.map(proportion_return => Math.log(1+proportion_return));

    df.addColumn(
        {column: "hourly_log_return", values: hourly_log_return, inplace: true}
    )

    return df.dropna(0).loc({columns: ['startedAt', 'close', 'hourly_proportion_return', 'hourly_log_return']})
}


function graphCorrelationStats (arr, labels, min, max) {

    var formattedData = arr.map( function (row, i) {
        return row.map(function (val, j) {
           return {x: labels[j], y: labels[i], v: val} 
        })
    }).flat();

    // destroy correlation heat map context
    if (Object.keys(myCharts).includes("correlationHeatMap")) {
        myCharts["correlationHeatMap"].destroy();
        delete myCharts["correlationHeatMap"];
    }

    var [m,n] = [arr.length, arr[0].length];

    myCharts["correlationHeatMap"] = new Chart('correlationHeatMap', {
        type: 'matrix',
        data: {
            datasets: [{
                label: 'Asset Correlation Coefficients',
                data: formattedData,
                borderWidth: 1,
                borderColor: 'rgba(0,0,0,0.5)',
                backgroundColor(context) {
                    // linearCombColors(rgba0, rgba1, w)
                    const value = context.dataset.data[context.dataIndex].v;
                    const w = (value-min) / (max-min);
                    var [r,g,b,a] = powCombColors([28, 188, 124, 0.8], [228, 44, 75, 0.74], w, 1);
                    return `rgba(${r},${g},${b},${a})`;
                },
                width(c) {
                    const a = c.chart.chartArea || {};
                    return (a.right - a.left) / n - 1;
                },
                height(c) {
                    const a = c.chart.chartArea || {};
                    return (a.bottom - a.top) / m - 1;
                }
            }],
      },
      options: {
        plugins: {
            tooltip: {
                callbacks: {
                    title() {
                        return '';
                    },
                    label(context) {
                        const v = context.dataset.data[context.dataIndex];
                        return [`${v.x} vs. ${v.y} Correlation: ${v.v}`];
                    }
                }
            }
        },
        scales: {
          x: {
            type: 'category',
            labels: labels,
            ticks: {display: true},
            offset: true
          },
          y: {
            type: 'category',
            labels: labels,
            ticks: {display: true},
            offset: true
          }
        }
    }
    });
}





