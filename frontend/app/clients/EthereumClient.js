var utils = require("../js/utils");
var fixtures = require("../js/fixtures");

var bigRat = require('big-rational');

var web3 = require('ethereum.js');
window.web3 = web3;

if (ethBrowser)
    web3.setProvider(new web3.providers.QtProvider());
else
    web3.setProvider(new web3.providers.HttpRpcProvider('http://localhost:8080'));

var contract = web3.contract(fixtures.addresses.etherex, fixtures.contract_desc);
console.log("CONTRACT", contract);

// web3.setProvider(new web3.providers.WebSocketProvider('ws://localhost:40404/eth'));
// web3.setProvider(new web3.providers.AutoProvider());

var EthereumClient = function() {

    this.loadAddresses = function(success, failure) {
        var error = null;

        try {
            web3.eth.accounts.then(function(accounts) {
                if (!accounts.length)
                    failure("No accounts were found on this Ethereum node.");
                success(accounts);
            }, function(e) {
                error = String(e);
                throw error;
            });
        }
        catch(e) {
            failure("Unable to load addresses, are you running an Ethereum node? Please load this URL in AlethZero, or with a cpp-ethereum node with JSONRPC enabled running alongside a regular browser. The actual error was: " + error);
        }
    };

    this.loadMarkets = function(user, success, failure) {
        var error = null;
        var total = 0;
        var markets = [{}];

        try {
            web3.eth.stateAt(fixtures.addresses.etherex, "0x5").then(function (hextotal) {
                total = _.parseInt(web3.toDecimal(hextotal));
                console.log("TOTAL MARKETS: " + total);

                var marketPromises = [];

                for (var id = 1; id < total + 1; id++) {
                    var marketPromise = new Promise(function (resolve, reject) {
                        contract.get_market(String(id)).call().then(function (market) {
                            console.log("Market from ABI:", market);

                            var id = _.parseInt(market[0]);
                            var name = web3.toAscii(market[1]);
                            var address = market[2];
                            var decimals = _.parseInt(market[3]);
                            var precision = _.parseInt(market[4]);
                            var minimum = _.parseInt(market[5]);
                            if (market[6] == '2336')
                                var lastPrice = null;
                            else
                                var lastPrice = _.parseInt(_.parseInt(market[6])) / Math.pow(10, precision.length - 1);
                            var owner = market[7];
                            var block = _.parseInt(market[8]);

                            web3.eth.stateAt(address, user.addresses[0]).then(function (balance) {
                                resolve({
                                    id: id,
                                    name: name,
                                    address: web3.fromDecimal(bigRat(address).valueOf()),
                                    decimals: decimals,
                                    minimum: minimum,
                                    precision: precision,
                                    lastPrice: lastPrice,
                                    owner: web3.fromDecimal(bigRat(owner).valueOf()),
                                    block: block,
                                    balance: _.parseInt(balance),
                                });
                            }, function(e) {
                                reject("Unable to get market balance: " + String(e));
                            });
                        }, function(e) {
                            reject("Contract error: " + String(e));
                        });
                    });
                    marketPromises.push(marketPromise);
                }

                Promise.all(marketPromises).then(function (markets) {
                    success(markets);
                }, function(e) {
                    failure("Could not load all markets: " + String(e));
                });

            }, function(e) {
                failure("There seems to be a contract there, but no market was found: " + String(e));
            });
        }
        catch (e) {
            failure("Unable to load markets: " + String(e));
        }
    };

    this.registerMarket = function(market, success, failure) {
        var data =
            eth.pad(7, 32) +
            eth.pad(market.name, 32) +
            eth.pad(market.address, 32) +
            eth.pad(market.minimum, 32) +
            eth.pad(market.decimals, 32) +
            eth.pad(market.precision, 32);

        try {
            if (ethBrowser)
                eth.transact({
                    from: eth.key,
                    value: "0",
                    to: fixtures.addresses.etherex,
                    data: eth.fromAscii(data),
                    gas: "10000",
                    gasPrice: eth.gasPrice
                }, success);
            else
                eth.transact(
                    eth.key,
                    "0",
                    fixtures.addresses.etherex,
                    data,
                    "10000",
                    eth.gasPrice,
                    success
                );
        }
        catch(e) {
            failure(e);
        }
    };

    this.setUserWatches = function(flux, addresses, markets) {
        // ETH balance
        web3.eth.watch({altered: addresses}).changed(flux.actions.user.updateBalance);

        // FIXME
        // Sub balances
        // var market_addresses = _.rest(_.pluck(markets, 'address'));
        // eth.watch({altered: market_addresses}).changed(flux.actions.user.updateBalanceSub);
    };

    this.setMarketWatches = function(flux, markets) {
        flux.actions.trade.loadTrades();
        web3.eth.watch({altered: fixtures.addresses.etherex}).changed(flux.actions.trade.updateTrades);
    };

    this.updateBalance = function(address, success, failure) {
        try {
            web3.eth.balanceAt(address).then(function (hexbalance) {
                balance = web3.toDecimal(hexbalance);
                success(balance, null);
            }, function(e) {
                failure(error + e);
            });
        }
        catch(e) {
            failure("Failed to update balance: " + e);
        }

        // var confirmed = web3.toDecimal(web3.eth.balanceAt(address, -1));
        // var unconfirmed = web3.toDecimal(web3.eth.balanceAt(address));
        // var showUnconfirmed = false;

        // if (unconfirmed != confirmed) {
        //     showUnconfirmed = true;
        //     unconfirmed = this.formatUnconfirmed(confirmed, unconfirmed, utils.formatBalance);
        // }

        // if (confirmed >= 0) {
        //     success(
        //       confirmed,
        //       showUnconfirmed ? "(" + unconfirmed + " unconfirmed)" : null
        //     );
        // }
        // else {
        //     failure("Failed to update balance. We fell.");
        // }
    };


    this.updateBalanceSub = function(market, address, success, failure) {
        try {
            web3.eth.stateAt(market.address, address).then(function (hexbalance) {
                balance = web3.toDecimal(hexbalance);
                success(balance, null);
            }, function(e) {
                failure("Failed to update subcurrency balance: " + e);
            });
        }
        catch(e) {
            failure(error);
        }

        // var confirmed = web3.toDecimal(web3.eth.stateAt(market.address, address, -1));
        // var unconfirmed = web3.toDecimal(web3.eth.stateAt(market.address, address));
        // var showUnconfirmed = false;

        // // DEBUG
        // // console.log("confirmed: " + confirmed);
        // // console.log("unconfirmed: " + unconfirmed);
        // // console.log(this.formatUnconfirmed(confirmed, unconfirmed));

        // if (unconfirmed != confirmed) {
        //     showUnconfirmed = true;
        //     unconfirmed = this.formatUnconfirmed(confirmed, unconfirmed, utils.format);
        // }

        // if (confirmed >= 0) {
        //     success(
        //       confirmed > 0 ? confirmed : 0,
        //       showUnconfirmed ? "(" + unconfirmed + " unconfirmed)" : null
        //     );
        // }
        // else {
        //     failure("Failed to update subcurrency balance. No dice.");
        // }
    };


    this.loadTrades = function(flux, markets, progress, success, failure) {
        var total = 0;
        var trades = [];

        try {
            web3.eth.stateAt(fixtures.addresses.etherex, "0x6").then(function (hextotal) {
                total = _.parseInt(web3.toDecimal(hextotal));
                console.log("TOTAL TRADES: ", total);

                var tradePromises = [];

                for (var id = 1; id < total + 1; id++) {
                    var tradePromise = new Promise(function (resolve, reject) {
                        contract.get_trade(String(id)).call().then(function (trade) {
                            console.log("Trade from ABI:", trade);

                            var id = _.parseInt(trade[0]);
                            var type = _.parseInt(trade[1]);
                            var marketid = _.parseInt(trade[2]);
                            var amountPrecision = Math.pow(10, markets[marketid].decimals);
                            var precision = markets[marketid].precision;

                            console.log("Loading trade " + id + " for market " + markets[marketid].name);

                            var amount = bigRat(web3.toDecimal(trade[3])).divide(amountPrecision).valueOf();
                            var price = bigRat(web3.toDecimal(trade[4])).divide(precision).valueOf();

                            // console.log("Filling: " + eth.toDecimal(eth.stateAt(fixtures.addresses.trades, String(ptr))));
                            // console.log("Pending: " + eth.toDecimal(eth.stateAt(fixtures.addresses.trades, String(ptr), 0)));
                            // console.log("Mined: " + eth.toDecimal(eth.stateAt(fixtures.addresses.trades, String(ptr), -1)));

                            resolve({
                                id: trade[0],
                                type: type == 1 ? 'buys' : 'sells',
                                price: price,
                                amount: amount,
                                total: amount * price,
                                owner: trade[5],
                                market: {
                                    id: marketid,
                                    name: markets[marketid].name
                                },
                                status: 'pending',
                                // status: (eth.toDecimal(eth.stateAt(fixtures.addresses.trades, String(ptr+1), 0)) == 0 ||
                                         // eth.toDecimal(eth.stateAt(fixtures.addresses.trades, String(ptr+1), -1)) == 0) ?
                                        // "pending" : "mined"
                                block: _.parseInt(trade[6])
                            });

                            // Update progress
                            progress({percent: (i + 1) / total * 100 });

                        }, function(e) {
                            reject("Contract error: " + String(e));
                        });
                    });
                    tradePromises.push(tradePromise);
                }

                Promise.all(tradePromises).then(function (trades) {
                    success(trades);
                }, function(e) {
                    failure("Could not load all trades: " + String(e));
                });

            }, function(e) {
                failure("There seems to be a contract there, but no market was found: " + String(e));
            });
        }
        catch (e) {
            failure("Unable to load trades: " + String(e));
        };
    };


    this.addTrade = function(trade, market, success, failure) {
        // console.log(trade.amount, trade.price, trade);
        var amounts = this.getAmounts(trade.amount, trade.price, market.decimals, market.precision);

        var data =
            eth.pad(trade.type, 32) +
            eth.pad(amounts.amount, 32) +
            eth.pad(amounts.price, 32) +
            eth.pad(trade.market, 32);

        console.log("Sending " + eth.fromAscii(data));
        if (trade.type == 1)
            console.log("with " + amounts.total + " wei");

        try {
            if (ethBrowser)
                eth.transact({
                    from: eth.key,
                    value: trade.type == 1 ? amounts.total : "0",
                    to: fixtures.addresses.etherex,
                    data: eth.fromAscii(data),
                    gas: "10000",
                    gasPrice: eth.gasPrice
                }, success);
            else
                eth.transact(
                    eth.key,
                    trade.type == 1 ? amounts.total : "0",
                    fixtures.addresses.etherex,
                    data,
                    "10000",
                    eth.gasPrice,
                    success
                );
        }
        catch(e) {
            failure(e);
        }
    };

    this.fillTrades = function(trades, market, success, failure) {
        var total = bigRat(0);

        for (var i = trades.length - 1; i >= 0; i--) {
            var amounts = this.getAmounts(trades[i].amount, trades[i].price, market.decimals, market.precision);
            total += bigRat(amounts.total);
        };

        var ids = _.pluck(trades, 'id');
        var data = eth.pad(3, 32);

        for (var i = ids.length - 1; i >= 0; i--) {
            data += eth.pad(ids[i], 32);
        };

        var gas = ids.length * 10000;

        // console.log("Posting " + eth.fromAscii(data));
        // console.log("with value " + utils.formatBalance(total.toString()));

        try {
            if (ethBrowser)
                eth.transact({
                    from: eth.key,
                    value: total > 0 ? total.toString() : "0",
                    to: fixtures.addresses.etherex,
                    data: eth.fromAscii(data),
                    gas: String(gas),
                    gasPrice: eth.gasPrice
                }, success);
            else
                eth.transact(
                    eth.key,
                    total > 0 ? total.toString() : "0",
                    fixtures.addresses.etherex,
                    data,
                    String(gas),
                    eth.gasPrice,
                    success
                );
        }
        catch(e) {
            failure(e);
        }
    };

    this.fillTrade = function(trade, market, success, failure) {
        var amounts = this.getAmounts(trade.amount, trade.price, market.decimals, market.precision);

        var data =
            eth.pad(3, 32) +
            eth.pad(trade.id, 32);

        try {
            if (ethBrowser)
                eth.transact({
                    from: eth.key,
                    value: trade.type == "sell" ? amounts.total : "0",
                    to: fixtures.addresses.etherex,
                    data: eth.fromAscii(data),
                    gas: "10000",
                    gasPrice: eth.gasPrice
                }, success);
            else
                eth.transact(
                    eth.key,
                    trade.type == "sell" ? amounts.total : "0",
                    fixtures.addresses.etherex,
                    data,
                    "10000",
                    eth.gasPrice,
                    success
                );
        }
        catch(e) {
            failure(e);
        }
    };

    this.cancelTrade = function(trade, success, failure) {
        var data =
            eth.pad(6, 32) +
            eth.pad(trade.id, 32);

        try {
            if (ethBrowser)
                eth.transact({
                    from: eth.key,
                    value: "0",
                    to: fixtures.addresses.etherex,
                    data: eth.fromAscii(data),
                    gas: "10000",
                    gasPrice: eth.gasPrice
                }, success);
            else
                eth.transact(
                    eth.key,
                    "0",
                    fixtures.addresses.etherex,
                    data,
                    "10000",
                    eth.gasPrice,
                    success
                );
        }
        catch(e) {
            failure(e);
        }
    };

    this.loadTransactions = function(addresses, market, success, failure) {
        var latest = []; // no eth.messages in eth.js...
        var prices = [];

        console.log("Loading transactions...");

        var slot = ((market.id - 1) * fixtures.market_fields + 20).toString(16);
        web3.eth.logs({
            max: 100,
            latest: -1,
            // from: fixtures.addresses.etherex,
            // to: fixtures.addresses.etherex,
            altered: {
                id: fixtures.addresses.etherex,
                at: "0x" + slot // "0x69" // TODO get market price slot
            }
        }).then(function (prices) {
            console.log("PRICE CHANGES: " + prices.length);
            if (prices.length)
                console.log("PRICE DATA: " + prices[0].input);

            var from = eth.messages({max: 100, latest: -1, altered: addresses[0], from: fixtures.addresses.etherex});
            // console.log(from.length);
            // var to = eth.messages({latest: -1, altered: addresses[0], to: addresses[1]});
            // console.log(to.length);
            var origin = eth.messages({max: 100, latest: -1, altered: addresses[0], to: fixtures.addresses.etherex});
            // console.log(origin.length);
            // var to = eth.messages({latest: -1, altered: addresses[0], from: fixtures.addresses.etherex, to: addresses[0]});
            var latest = _.merge(from, origin);
            // console.log(latest.length);

            // if (typeof(addresses) == 'array' && addresses.length == 2)
            //     latest = _.filter(latest, {'to': addresses[1]});
            // for (var i = 0; i < addresses.length; i++) {
                // txs.push(_.filter(latest, {'to': addresses[1]}));
                // txs.push(_.filter(latest, {'from': addresses[1]}));
                // txs.push(_.filter(latest, {'origin': addresses[i]}));
            // };
            // latest.push(_.where(eth.messages({altered: addresses[0]}), {'from': addresses[1]}));
            // latest.push(eth.messages({latest: -1, from: addresses[1], to: addresses[0]}));

            var payload = {
                latest: latest,
                prices: prices
            };

            // if (latest.length <=0)
            //     var latest = [{}];

            if (latest || prices) // && latest.length > 0)
                success(payload);
        }, function(e) {
            failure("Could not get transactions: " + String(e));
        });
    };

    this.getAmounts = function(amount, price, decimals, precision) {
        var bigamount = bigRat(amount).multiply(bigRat(Math.pow(10, decimals))).floor(true).toString();
        var bigprice = bigRat(price).multiply(bigRat(precision)).floor(true).toString();
        var total = bigRat(amount)
            .multiply(price)
            .multiply(bigRat(fixtures.ether)).floor(true).toString();
        // console.log("amount: " + bigamount);
        // console.log("price: " + bigprice);
        // console.log("total: " + total);

        return {
            amount: bigamount,
            price: bigprice,
            total: total
        }
    };

    this.formatUnconfirmed = function(confirmed, unconfirmed, fn) {
        unconfirmed = unconfirmed - confirmed;
        if (unconfirmed < 0)
            unconfirmed = "- " + fn(-unconfirmed);
        else
            unconfirmed = fn(unconfirmed);

        return unconfirmed;
    };

};

module.exports = EthereumClient;
