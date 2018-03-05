"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const program = require("commander");
const chalk_1 = require("chalk");
const GTT = require("gdax-trading-toolkit");
const exchanges_1 = require("gdax-trading-toolkit/build/src/exchanges");
const core_1 = require("gdax-trading-toolkit/build/src/core");
const moment = require("moment");
const dotenv = require("dotenv");
const types_1 = require("gdax-trading-toolkit/build/src/lib/types");
const utils_1 = require("gdax-trading-toolkit/build/src/utils");
dotenv.config();
const logger = GTT.utils.ConsoleLoggerFactory();
const gdaxConfig = {
    logger: logger,
    apiUrl: process.env.GDAX_API_URL || exchanges_1.GDAX_API_URL,
    auth: {
        key: process.env.GDAX_KEY,
        secret: process.env.GDAX_SECRET,
        passphrase: process.env.GDAX_PASSPHRASE
    }
};
const gdax = new exchanges_1.GDAXExchangeAPI(gdaxConfig);
class Sma {
    constructor(period) {
        this._price = new CircularQueue(period);
    }
    update(price) {
        this._price.addToHead(price);
    }
    get val() {
        return this._price.sum((a, b) => a.plus(b), types_1.ZERO).dividedBy(this._price.size);
    }
}
class CircularQueue {
    constructor(size) {
        this._storage = new Array(size + 1);
        this._size = size + 1;
        this._write = 0;
        this._read = 0;
        this._count = 0;
    }
    addToHead(val) {
        // Check if queue is full
        if (this._read === ((this._write + 1) % this._size)) {
            this._read = (this._read + 1) % this._size;
            this._count--;
        }
        this._storage[this._write] = val;
        this._write = (this._write + 1) % this._size;
        this._count++;
    }
    get size() {
        return this._count;
    }
    sum(cb, initial) {
        let sum = initial;
        for (let i = 0, j = this._read; i < this._count; i++, j = (j + 1) % this._size) {
            sum = cb(sum, this._storage[j]);
        }
        return sum;
    }
}
program
    .version('0.1.0')
    .description('Simple Command Line Trader')
    .usage('command [options]');
program
    .command('buy [pair] [other...]')
    .alias('b')
    .description('Execute a buy order')
    .option('-s, --size [size]', 'Order Size')
    .option('-m, --market', 'Market Order Type')
    .option('-l, --limit <price>', 'Limit Order type')
    .action(parseBuy)
    .on('--help', function () {
    console.log('');
    console.log('  Examples:');
    console.log('');
    console.log('    $ trade buy 0.5\t\t\tBTC-USD market order');
    console.log('    $ trade buy 1.1 BTC-USD 0.5\t\tETH-USD market order');
    console.log('    $ trade buy 1.2 limit 850\t\tBTC-USD limit order at $850');
    console.log('    $ trade b 1.0 -l 850\t\tBTC-USD limit order at $850');
    console.log('    $ trade b -s 1.0 -l 850\t\tBTC-USD limit order at $850');
    console.log('    $ trade b --size 1.0 --limit 850\tBTC-USD limit order at $850');
    console.log('');
});
program
    .command('sell [pair] [other...]')
    .alias('s')
    .description('Execute a sell order')
    .option('-s, --size [size]', 'Order Size')
    .option('-m, --market', 'Market Order Type')
    .option('-l, --limit <price>', 'Limit Order type')
    .action(parseSell)
    .on('--help', function () {
    console.log('');
    console.log('  Examples:');
    console.log('');
    console.log('    $ trade sell 0.5\t\t\tBTC-USD market order');
    console.log('    $ trade sell 1.1 BTC-USD 0.5\tETH-USD market order');
    console.log('    $ trade sell 1.2 limit 850\t\tBTC-USD limit order at $850');
    console.log('    $ trade s 1.0 -l 850\t\tBTC-USD limit order at $850');
    console.log('    $ trade s -s 1.0 -l 850\t\tBTC-USD limit order at $850');
    console.log('    $ trade s --size 1.0 --limit 850\tBTC-USD limit order at $850');
    console.log('');
});
program
    .command('cancel [order]')
    .alias('c')
    .description('Cancel an order request')
    .option('-o, --order <id>', 'Order ID')
    .action(parseCancel)
    .on('--help', function () {
    console.log('');
    console.log('  Examples:');
    console.log('');
    console.log('    $ trade cancel 08cd7324-2ca6-4c3e-a8f0-dafa891d662e');
    console.log('    $ trade c 08cd7324-2ca6-4c3e-a8f0-dafa891d662e');
    console.log('');
});
program
    .command('orders <cmd>')
    .alias('o')
    .description('Fetch orders')
    .action(parseOrders)
    .on('--help', function () {
    console.log('');
    console.log('  Examples:');
    console.log('');
    console.log('    $ trade orders ls');
    console.log('    $ trade orders live');
    console.log('');
});
program
    .command('ticker')
    .alias('t')
    .description('Get Price Ticker')
    .option('-p, --product <product>', 'Currency Pair')
    .action(parseTicker)
    .on('--help', function () {
    console.log('');
    console.log('  Examples:');
    console.log('');
    console.log('    $ trade ticker\t\t\tPrice Ticker for BTC-USD');
    console.log('    $ trade t\t\t\t\tPrice Ticker for BTC-USD');
    console.log('    $ trade t -p ETH-USD\t\tPrice Ticker for ETH-USD');
    console.log('');
});
program.on('--help', function () {
    console.log('');
    console.log('  Examples:');
    console.log('');
    console.log('    $ trade buy 0.5');
    console.log('    $ trade sell 1.1 BTC-USD 0.5');
    console.log('    $ trade cancel 16a2bd87-8b85-467b-9dff-624e57b042ea');
    console.log('    $ trade orders ls');
    console.log('');
});
program.parse(process.argv);
if (!process.argv.slice(2).length) {
    program.outputHelp();
}
function parseBuy(pair, [size, type, price], cmd) {
    let order = parseInputs(pair, size, type, price, cmd);
    order = setDefaults(order);
    order = checkValues(order);
    if (order) {
        buy(order);
    }
}
;
function parseSell(pair, [size, type, price], cmd) {
    let order = parseInputs(pair, size, type, price, cmd);
    order = setDefaults(order);
    order = checkValues(order);
    if (order) {
        sell(order);
    }
}
;
function parseCancel(order, cmd) {
    let orderId;
    if (cmd.order) {
        orderId = cmd.order;
    }
    if (order) {
        orderId = order;
    }
    if (!order) {
        console.log('Please supply a valid Order Id');
        return;
    }
    cancel(orderId);
}
function parseOrders(cmd) {
    if (cmd === 'ls') {
        listOrders();
    }
    if (cmd === 'live') {
        showLiveOrders();
    }
}
function parseTicker(options) {
    let product = 'BTC-USD';
    if (options.product) {
        product = options.product;
    }
    loadTicker(product);
}
function parseInputs(pair, size, type, price, cmd) {
    if (pair && !isNaN(parseFloat(pair))) {
        price = type;
        type = size;
        size = pair;
        pair = 'BTC-USD';
    }
    let p = pair, s = cmd.size, t, pr;
    if (cmd.market) {
        t = 'market';
    }
    if (cmd.limit) {
        t = 'limit';
        pr = cmd.limit;
    }
    // Override options with inline params
    if (size) {
        s = parseFloat(size);
    }
    if (type) {
        if (type === 'm' || type === 'market') {
            t = 'market';
        }
        if (type === 'l' || type === 'limit') {
            t = 'limit';
            if (price) {
                pr = parseFloat(price);
            }
        }
    }
    let order = {
        pair: p,
        size: s,
        type: t,
        price: pr
    };
    return order;
}
function setDefaults(order) {
    // set Default Pair
    if (!order.pair) {
        order.pair = 'BTC-USD';
    }
    // set Default Order Type
    if (!order.type) {
        order.type = 'market';
    }
    return order;
}
function checkValues(order) {
    // check parameters
    if (isNaN(order.size) || order.size <= 0) {
        console.log('Order size must be greater than zero');
        return null;
    }
    if (order.type === 'limit' && (isNaN(order.price) || order.price <= 0)) {
        console.log('Invalid Limit Order Price');
        return null;
    }
    return order;
}
function sell(order) {
    const { pair: p, size: s, type: t, price: pr } = order;
    const [base, quote] = p.split('-');
    console.log(chalk_1.default.dim('Placing a ') + chalk_1.default.bold.white(`${t}`) + ' ' + chalk_1.default.red('sell') + chalk_1.default.dim(' order for ') + chalk_1.default.bold.white(s + ' ' + base) + (t === 'limit' ? chalk_1.default.dim(' at ') + chalk_1.default.bold.white(pr + ' ' + quote) : ''));
    const orderMessage = {
        productId: order.pair,
        side: 'sell',
        orderType: order.type,
        price: order.price.toString(),
        postOnly: true,
        size: order.size.toString(),
        type: 'placeOrder',
        time: null
    };
    gdax.placeOrder(orderMessage).then((liveOrder) => {
        console.log(`Order Placed. Result: ${liveOrder.status}`);
        console.log(`Order Id: ${liveOrder.id}`);
    });
}
function buy(order) {
    const { pair: p, size: s, type: t, price: pr } = order;
    const [base, quote] = p.split('-');
    console.log(chalk_1.default.dim('Placing a ') + chalk_1.default.bold.white(`${t}`) + ' ' + chalk_1.default.green('buy') + chalk_1.default.dim(' order for ') + chalk_1.default.bold.white(s + ' ' + base) + (t === 'limit' ? chalk_1.default.dim(' at ') + chalk_1.default.bold.white(pr + ' ' + quote) : ''));
    const orderMessage = {
        productId: order.pair,
        side: 'buy',
        orderType: order.type,
        price: order.price.toString(),
        postOnly: true,
        size: order.size.toString(),
        type: 'placeOrder',
        time: null
    };
    gdax.placeOrder(orderMessage).then((liveOrder) => {
        console.log(`Order Placed. Result: ${liveOrder.status}`);
        console.log(`Order Id: ${liveOrder.id}`);
    });
}
function cancel(orderId) {
    gdax.cancelOrder(orderId).then((response) => {
        console.log(response);
    });
}
function listOrders(product = 'BTC-USD') {
    gdax.loadAllOrders(product).then((orders) => {
        console.log(chalk_1.default.dim('side\tsize\tprice\ttime\t\tstatus\torderId'));
        orders.forEach(order => {
            console.log(printOrder(order));
        });
    });
}
function printOrder(order) {
    return `${order.side === 'buy' ? chalk_1.default.green(order.side) : chalk_1.default.red(order.side)}\t${order.size}\t${order.price}\t${moment(order.time).fromNow()}\t${chalk_1.default.dim(order.status)}\t${chalk_1.default.dim(order.id)}`;
}
function loadTicker(product = 'BTC-USD') {
    let gdaxFeedConfig = gdaxConfig;
    gdaxFeedConfig.apiUrl = process.env.GDAX_WS_FEED || exchanges_1.GDAX_WS_FEED;
    let sma = new Sma(5);
    let lastSma = types_1.ZERO;
    GTT.Factories.GDAX.getSubscribedFeeds(gdaxFeedConfig, [product]).then((feed) => {
        GTT.Core.createTickerTrigger(feed, product, false)
            .setAction((ticker) => {
            let direction = '|';
            sma.update(ticker.price);
            let slope = sma.val.minus(lastSma);
            lastSma = sma.val;
            if (slope.gt(0)) {
                if (slope.gt(2)) {
                    direction += '|';
                }
                else if (slope.gt(4)) {
                    direction += '|';
                }
                else if (slope.gt(6)) {
                    //three + fire
                    direction += ' 🔥';
                }
                direction = chalk_1.default.green(padString(direction, 5));
            }
            else if (slope.lt(0)) {
                if (slope.lt(-2)) {
                    direction += '|';
                }
                else if (slope.lt(-4)) {
                    direction += '|';
                }
                else if (slope.lt(-6)) {
                    //three + fire
                    direction += ' 🔥';
                }
                direction = chalk_1.default.red(padString(direction, 5));
            }
            else {
                direction = chalk_1.default.dim(padString(direction, 5));
            }
            console.log(direction + ' ' + printTicker(ticker, 3));
        });
    });
}
function showLiveOrders(product = 'BTC-USD') {
    let gdaxFeedConfig = gdaxConfig;
    gdaxFeedConfig.apiUrl = process.env.GDAX_WS_FEED || exchanges_1.GDAX_WS_FEED;
    GTT.Factories.GDAX.getSubscribedFeeds(gdaxFeedConfig, [product]).then((feed) => {
        createTradeExecutedTrigger(feed, product, false)
            .setAction((msg) => {
            console.log(printTradeExecutedMessage(msg));
        });
        createTradeFinalizedTrigger(feed, product, false)
            .setAction((msg) => {
            console.log(printTradeFinalizedMessage(msg));
        });
        createMyOrderPlacedTrigger(feed, product, false)
            .setAction((msg) => {
            console.log(printMyOrderPlacedMessage(msg));
        });
    });
}
function createTradeExecutedTrigger(feed, product, onlyOnce = false) {
    const trigger = new core_1.Trigger(feed);
    const tradeFilter = (msg) => {
        if (msg.type === 'tradeExecuted' && msg.productId === product) {
            if (onlyOnce) {
                trigger.cancel();
            }
            trigger.execute(msg);
        }
    };
    return trigger.setFilter(tradeFilter);
}
function createTradeFinalizedTrigger(feed, product, onlyOnce = false) {
    const trigger = new core_1.Trigger(feed);
    const tradeFilter = (msg) => {
        if (msg.type === 'tradeFinalized' && msg.productId === product) {
            if (onlyOnce) {
                trigger.cancel();
            }
            trigger.execute(msg);
        }
    };
    return trigger.setFilter(tradeFilter);
}
function createMyOrderPlacedTrigger(feed, product, onlyOnce = false) {
    const trigger = new core_1.Trigger(feed);
    const tradeFilter = (msg) => {
        if (msg.type === 'myOrderPlaced' && msg.productId === product) {
            if (onlyOnce) {
                trigger.cancel();
            }
            trigger.execute(msg);
        }
    };
    return trigger.setFilter(tradeFilter);
}
function printTradeExecutedMessage(msg) {
    return (`${chalk_1.default.bold.white(padString('Trade Executed:', 19))}` +
        `${msg.side === 'buy' ? chalk_1.default.green(padString(msg.side, 7)) : chalk_1.default.red(padString(msg.side, 7))}` +
        `${chalk_1.default.bold.white(padString(msg.orderType, 11))}` +
        `${chalk_1.default.dim('Size: ')}${chalk_1.default.bold.white(padString(msg.tradeSize, 13))}` +
        `${chalk_1.default.dim('Remaining: ')}${chalk_1.default.bold.white(padString(msg.remainingSize, 13))}` +
        `${chalk_1.default.dim('Price: ')}${chalk_1.default.bold.white(truncate(msg.price))}  ` +
        `${chalk_1.default.dim(padString(moment(msg.time).format('MM/D/YY, H:mm:ss'), 19))}` +
        `${chalk_1.default.dim(msg.orderId)}`);
}
;
function printTradeFinalizedMessage(msg) {
    return (`${chalk_1.default.dim(padString('Trade Finalized:', 19))}` +
        `${msg.side === 'buy' ? chalk_1.default.green(padString(msg.side, 7)) : chalk_1.default.red(padString(msg.side, 7))}` +
        `${chalk_1.default.dim(padString(msg.reason, 11))}` +
        `${chalk_1.default.dim(padString('Size: N/A', 19))}` +
        `${chalk_1.default.dim('Remaining: ')}${chalk_1.default.bold.white(padString(msg.remainingSize, 13))}` +
        `${chalk_1.default.dim('Price: ')}${chalk_1.default.bold.white(truncate(msg.price))}  ` +
        `${chalk_1.default.dim(padString(moment(msg.time).format('MM/D/YY, H:mm:ss'), 19))}` +
        `${chalk_1.default.dim(msg.orderId)}`);
}
;
function printMyOrderPlacedMessage(msg) {
    return (`${chalk_1.default.dim(padString('Order Placed:', 19))}` +
        `${msg.side === 'buy' ? chalk_1.default.green(padString(msg.side, 7)) : chalk_1.default.red(padString(msg.side, 7))}` +
        `${chalk_1.default.bold.white(padString(msg.orderType, 11))}` +
        `${chalk_1.default.dim('Size: ')}${chalk_1.default.bold.white(padString(msg.size, 13))}` +
        `${chalk_1.default.dim(padString('Remaining: N/A', 24))}` +
        `${chalk_1.default.dim('Price: ')}${chalk_1.default.bold.white(truncate(msg.price))}  ` +
        `${chalk_1.default.dim(padString(moment(msg.time).format('MM/D/YY, H:mm:ss'), 19))}` +
        `${chalk_1.default.dim(msg.orderId)}`);
}
function printTicker(ticker, quotePrec = 2) {
    return `${chalk_1.default.dim('Price: ')}${chalk_1.default.bold.white(truncate(utils_1.padfloat(ticker.price, 10, quotePrec)))}${chalk_1.default.dim(' | Bid: ' + utils_1.padfloat(ticker.bid, 10, quotePrec))}` +
        `${chalk_1.default.dim(' | Ask: ' + utils_1.padfloat(ticker.ask, 10, quotePrec) + ' | sequence: ' + (ticker.trade_id ? ticker.trade_id : 'N/A'))}`;
}
function padString(str, size) {
    return size - str.length > 0 ? str + new Array(size - str.length + 1).join(' ') : str;
}
function truncate(str, prec = 2) {
    let [integer, decimal] = str.split('.');
    return integer.concat('.', decimal.slice(0, 2));
}
