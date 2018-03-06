
import * as program from 'commander';
import chalk from 'chalk';
import * as GTT from 'gdax-trading-toolkit';
import { GDAXConfig } from 'gdax-trading-toolkit/build/src/exchanges/gdax/GDAXInterfaces';
import { GDAXExchangeAPI, GDAX_WS_FEED, GDAX_API_URL, GDAXFeed, ExchangeFeed } from 'gdax-trading-toolkit/build/src/exchanges';
import { LiveOrder } from 'gdax-trading-toolkit/build/src/lib';
import { PlaceOrderMessage, TradeExecutedMessage, TradeFinalizedMessage, MyOrderPlacedMessage, Trigger, TickerMessage, StreamMessage } from 'gdax-trading-toolkit/build/src/core';
import * as moment from 'moment';
import * as dotenv from 'dotenv';
import { BigJS, ZERO } from 'gdax-trading-toolkit/build/src/lib/types';
import { Ticker } from 'gdax-trading-toolkit/build/src/exchanges/PublicExchangeAPI';
import { padfloat } from 'gdax-trading-toolkit/build/src/utils';
import * as fs from 'fs';
import { WriteStream } from 'fs';

dotenv.config();

const logger = GTT.utils.ConsoleLoggerFactory();

const gdaxConfig: GDAXConfig = {
  logger: logger,
  apiUrl: process.env.GDAX_API_URL || GDAX_API_URL,
  auth: {
    key: process.env.GDAX_KEY,
    secret: process.env.GDAX_SECRET,
    passphrase: process.env.GDAX_PASSPHRASE
  }
};

const gdax = new GDAXExchangeAPI(gdaxConfig);

interface Order {
  pair: string;
  size: number;
  type: string;
  price: number;
}

class Sma {
  private _price: CircularQueue;

  constructor(period: number) {
    this._price = new CircularQueue(period);
  }

  update(price: BigJS) {
    this._price.addToHead(price);
  }

  get val() {
    return this._price.sum((a: BigJS, b: BigJS) => a.plus(b), ZERO).dividedBy(this._price.size);
  }
}

class CircularQueue {

  private _storage: BigJS[];
  private _size: number;
  private _write: number;
  private _read: number;
  private _count: number;

  constructor(size: number) {
    this._storage = new Array(size + 1);
    this._size = size + 1;
    this._write = 0;
    this._read = 0;
    this._count = 0;
  }

  addToHead(val: any) {

    // Check if queue is full
    if (this._read === ((this._write + 1) % this._size)) {
      this._read = (this._read + 1) % this._size;
      this._count--;
    }

    this._storage[this._write] = val;
    this._write = (this._write + 1) % this._size;
    this._count++;
  }

  get size(): number {
    return this._count;
  }

  sum(cb:Function, initial: any) {
    let sum: any = initial;
    for (let i = 0, j = this._read; i < this._count; i++ , j = (j + 1) % this._size) {
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
  .command('orders [cmd]')
  .alias('o')
  .description('Fetch orders')
  .option('-l, --log [filename', 'Log to file')
  .option('-p, --product <product>', 'Currency Pair')
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

function parseBuy(pair: string, [size, type, price]: string[], cmd: any) {

  let order: Order = parseInputs(pair, size, type, price, cmd);
  order = setDefaults(order);
  order = checkValues(order);

  if (order) {
    buy(order);
  }
};


function parseSell(pair: string, [size, type, price]: string[], cmd: any) {

  let order: Order = parseInputs(pair, size, type, price, cmd);
  order = setDefaults(order);
  order = checkValues(order);

  if (order) {
    sell(order);
  }
};

function parseCancel(order: string, cmd: any) {

  let orderId: string;

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

function parseOrders(cmd: string, options: any) {
  
  let product = options.product ? options.product : 'BTC-USD';
  
  if (cmd === 'ls') {
    listOrders(product);
  }

  if (cmd === 'live' || options.log) {
    showLiveOrders(product, (cmd === 'live'), options.log);
  }
}

function parseTicker(options: any) {

  let product = 'BTC-USD';

  if (options.product) {
    product = options.product;
  }

  loadTicker(product);
}

function parseInputs(pair: string, size: string, type: string, price: string, cmd: any): Order {

  if (pair && !isNaN(parseFloat(pair))) {
    price = type;
    type = size;
    size = pair;
    pair = 'BTC-USD';
  }

  let p: string = pair,
    s: number = cmd.size,
    t: string, pr: number;

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

  let order: Order = {
    pair: p,
    size: s,
    type: t,
    price: pr
  };

  return order;
}



function setDefaults(order: Order) {
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

function checkValues(order: Order): Order {

  // check parameters
  if (isNaN(order.size) || order.size <= 0) {
    console.log('Order size must be greater than zero');
    return null;
  }

  if (order.type === 'limit' && (isNaN(order.price) || order.price <= 0)) {
    console.log('Invalid Limit Order Price')
    return null;
  }

  return order;
}

function sell(order: Order) {
  const { pair: p, size: s, type: t, price: pr } = order;
  const [base, quote] = p.split('-');
  console.log(chalk.dim('Placing a ') + chalk.bold.white(`${t}`) + ' ' + chalk.red('sell') + chalk.dim(' order for ') + chalk.bold.white(s + ' ' + base) + (t === 'limit' ? chalk.dim(' at ') + chalk.bold.white(pr + ' ' + quote) : ''));

  const orderMessage: PlaceOrderMessage = {
    productId: order.pair,
    side: 'sell',
    orderType: order.type,
    price: order.price.toString(),
    postOnly: true,
    size: order.size.toString(),
    type: 'placeOrder',
    time: null
  }

  gdax.placeOrder(orderMessage).then((liveOrder: LiveOrder) => {
    console.log(`Order Placed. Result: ${liveOrder.status}`);
    console.log(`Order Id: ${liveOrder.id}`);
  })
}

function buy(order: Order) {
  const { pair: p, size: s, type: t, price: pr } = order;
  const [base, quote] = p.split('-');
  console.log(chalk.dim('Placing a ') + chalk.bold.white(`${t}`) + ' ' + chalk.green('buy') + chalk.dim(' order for ') + chalk.bold.white(s + ' ' + base) + (t === 'limit' ? chalk.dim(' at ') + chalk.bold.white(pr + ' ' + quote) : ''));

  const orderMessage: PlaceOrderMessage = {
    productId: order.pair,
    side: 'buy',
    orderType: order.type,
    price: order.price.toString(),
    postOnly: true,
    size: order.size.toString(),
    type: 'placeOrder',
    time: null
  }

  gdax.placeOrder(orderMessage).then((liveOrder: LiveOrder) => {
    console.log(`Order Placed. Result: ${liveOrder.status}`);
    console.log(`Order Id: ${liveOrder.id}`);
  })
}

function cancel(orderId: string) {
  gdax.cancelOrder(orderId).then((response: string) => {
    console.log(response);
  })
}

function listOrders(product: string = 'BTC-USD') {
  gdax.loadAllOrders(product).then((orders: LiveOrder[]) => {
    console.log(chalk.dim('side\tsize\tprice\ttime\t\tstatus\torderId'));
    orders.forEach(order => {
      console.log(printOrder(order));
    })
  })
}

function printOrder(order: LiveOrder) {
  return `${order.side === 'buy' ? chalk.green(order.side) : chalk.red(order.side)}\t${order.size}\t${order.price}\t${moment(order.time).fromNow()}\t${chalk.dim(order.status)}\t${chalk.dim(order.id)}`;
}

function loadTicker(product: string = 'BTC-USD') {
  let gdaxFeedConfig = gdaxConfig;
  gdaxFeedConfig.apiUrl = process.env.GDAX_WS_FEED || GDAX_WS_FEED

  let sma = new Sma(5);
  let lastSma: BigJS = ZERO;

  GTT.Factories.GDAX.getSubscribedFeeds(gdaxFeedConfig, [product]).then((feed: GDAXFeed) => {
    GTT.Core.createTickerTrigger(feed, product, false)
      .setAction((ticker: TickerMessage) => {
        let direction = '|';
        sma.update(ticker.price);
        let slope = sma.val.minus(lastSma);
        lastSma = sma.val;

        if (slope.gt(0)) {
          if (slope.gt(2)) {
            direction += '|';
          } else if (slope.gt(4)) {
            direction += '|';
          } else if (slope.gt(6)) {
            //three + fire
            direction += ' 🔥'
          }
          direction = chalk.green(padString(direction, 5));
        } else if (slope.lt(0)) {
          if (slope.lt(-2)) {
            direction += '|';
          } else if (slope.lt(-4)) {
            direction += '|';
          } else if (slope.lt(-6)) {
            //three + fire
            direction += ' 🔥'
          }
          direction = chalk.red(padString(direction, 5));
        } else {
          direction = chalk.dim(padString(direction, 5));
        }

        console.log(direction + ' ' + printTicker(ticker, 3));
      });
  });
}


function showLiveOrders(product: string = 'BTC-USD', display: boolean = true, log: string = null) {

  let gdaxFeedConfig = gdaxConfig;
  gdaxFeedConfig.apiUrl = process.env.GDAX_WS_FEED || GDAX_WS_FEED
  let orders: WriteStream = null;

  if (log) {
    let path = `${log}.csv`;
    if (/^.+\.[a-zA-Z0-9]{3}$/.test(log)) {
      path = `${/^(.+)\.[a-zA-Z0-9]{3}$/.exec(log)[1]}.csv`
    }
    orders = fs.createWriteStream(`./${path}`, { flags: 'a'});
    orders.write(createLogHeader() + '\n');
  }

  GTT.Factories.GDAX.getSubscribedFeeds(gdaxFeedConfig, [product]).then((feed: GDAXFeed) => {

    createTradeExecutedTrigger(feed, product, false)
      .setAction((msg: TradeExecutedMessage) => {
        if (display) {
          console.log(printTradeExecutedMessage(msg));
        }
        if (log) {
          orders.write(logTradeExecutedMessage(msg) + '\n', (err) => {
            if (err) {
              logger.log('error', 'Unable to write to log file', err);
            }
          });
        }
      });

    createTradeFinalizedTrigger(feed, product, false)
      .setAction((msg: TradeFinalizedMessage) => {
        if (display) {
          console.log(printTradeFinalizedMessage(msg));
        }
        if (log) {
          orders.write(logTradeFinalizedMessage(msg) + '\n', (err) => {
            if (err) {
              logger.log('error', 'Unable to write to log file', err);
            }
          });
        }
      });

    createMyOrderPlacedTrigger(feed, product, false)
      .setAction((msg: MyOrderPlacedMessage) => {
        if (display) {
          console.log(printMyOrderPlacedMessage(msg));
        }
        if (log) {
          orders.write(logMyOrderPlacedMessage(msg) + '\n', (err) => {
            if (err) {
              logger.log('error', 'Unable to write to log file', err);
            }
          });
        }
      });
  })

}

function createTradeExecutedTrigger(feed: ExchangeFeed, product: string, onlyOnce: boolean = false): Trigger<StreamMessage> {
  const trigger = new Trigger(feed);
  const tradeFilter = (msg: TradeExecutedMessage) => {

    if (msg.type === 'tradeExecuted' && msg.productId === product) {
      if (onlyOnce) {
        trigger.cancel();
      }
      trigger.execute(msg);
    }
  };
  return trigger.setFilter(tradeFilter);
}

function createTradeFinalizedTrigger(feed: ExchangeFeed, product: string, onlyOnce: boolean = false): Trigger<StreamMessage> {
  const trigger = new Trigger(feed);
  const tradeFilter = (msg: TradeFinalizedMessage) => {

    if (msg.type === 'tradeFinalized' && msg.productId === product) {
      if (onlyOnce) {
        trigger.cancel();
      }
      trigger.execute(msg);
    }
  };
  return trigger.setFilter(tradeFilter);
}

function createMyOrderPlacedTrigger(feed: ExchangeFeed, product: string, onlyOnce: boolean = false): Trigger<StreamMessage> {
  const trigger = new Trigger(feed);
  const tradeFilter = (msg: MyOrderPlacedMessage) => {

    if (msg.type === 'myOrderPlaced' && msg.productId === product) {
      if (onlyOnce) {
        trigger.cancel();
      }
      trigger.execute(msg);
    }
  };
  return trigger.setFilter(tradeFilter);
}


function printTradeExecutedMessage(msg: TradeExecutedMessage) {
  return (
    `${chalk.bold.white(padString('Trade Executed:', 19))}` +
    `${msg.side === 'buy' ? chalk.green(padString(msg.side, 7)) : chalk.red(padString(msg.side, 7))}` +
    `${chalk.bold.white(padString(msg.orderType, 11))}` +
    `${chalk.dim('Size: ')}${chalk.bold.white(padString(msg.tradeSize, 13))}` +
    `${chalk.dim('Remaining: ')}${chalk.bold.white(padString(msg.remainingSize, 13))}` +
    `${chalk.dim('Price: ')}${chalk.bold.white(truncate(msg.price))}  ` +
    `${chalk.dim(padString(moment(msg.time).format('MM/D/YY, H:mm:ss'), 19))}` +
    `${chalk.dim(msg.orderId)}`
  );
};

function printTradeFinalizedMessage(msg: TradeFinalizedMessage) {
  return (
    `${chalk.dim(padString('Trade Finalized:', 19))}` +
    `${msg.side === 'buy' ? chalk.green(padString(msg.side, 7)) : chalk.red(padString(msg.side, 7))}` +
    `${chalk.dim(padString(msg.reason, 11))}` +
    `${chalk.dim(padString('Size: N/A', 19))}` +
    `${chalk.dim('Remaining: ')}${chalk.bold.white(padString(msg.remainingSize, 13))}` +
    `${chalk.dim('Price: ')}${chalk.bold.white(truncate(msg.price))}  ` +
    `${chalk.dim(padString(moment(msg.time).format('MM/D/YY, H:mm:ss'), 19))}` +
    `${chalk.dim(msg.orderId)}`
  );
};

function printMyOrderPlacedMessage(msg: MyOrderPlacedMessage) {
  return (
    `${chalk.dim(padString('Order Placed:', 19))}` +
    `${msg.side === 'buy' ? chalk.green(padString(msg.side, 7)) : chalk.red(padString(msg.side, 7))}` +
    `${chalk.bold.white(padString(msg.orderType, 11))}` +
    `${chalk.dim('Size: ')}${chalk.bold.white(padString(msg.size, 13))}` +
    `${chalk.dim(padString('Remaining: N/A', 24))}` +
    `${chalk.dim('Price: ')}${chalk.bold.white(truncate(msg.price))}  ` +
    `${chalk.dim(padString(moment(msg.time).format('MM/D/YY, H:mm:ss'), 19))}` +
    `${chalk.dim(msg.orderId)}`
  );
}

function createLogHeader(delim: string = ',') {
  return (
    'Message Type' + delim +
    'Side' + delim +
    'Order Type' + delim +
    'Size' + delim +
    'Remaining' + delim +
    'Price' + delim +
    'Date' + delim + 'Time' + delim +
    'Order Id'
  );
}

function logMyOrderPlacedMessage(msg: MyOrderPlacedMessage, delim: string = ',') {
  return (
    'Order Placed' + delim +
    `${msg.side}` + delim +
    `${msg.orderType}` + delim +
    `${msg.size}` + delim +
    '' + delim +
    `${truncate(msg.price)}` + delim +
    `${moment(msg.time).format('MM/D/YY, H:mm:ss')}` + delim +
    `${msg.orderId}`
  );
}

function logTradeExecutedMessage(msg: TradeExecutedMessage, delim: string = ',') {
  return (
    'Trade Executed' + delim +
    `${msg.side}` + delim +
    `${msg.orderType}` + delim +
    `${msg.tradeSize}` + delim +
    `${msg.remainingSize}` + delim +
    `${truncate(msg.price)}` + delim +
    `${moment(msg.time).format('MM/D/YY, H:mm:ss')}` + delim +
    `${msg.orderId}`
  );
};

function logTradeFinalizedMessage(msg: TradeFinalizedMessage, delim: string = ',') {
  return (
    'Trade Finalized' + delim +
    `${msg.side}` + delim +
    `${msg.reason}` + delim +
    '' + delim +
    `${msg.remainingSize}` + delim +
    `${truncate(msg.price)}` + delim +
    `${moment(msg.time).format('MM/D/YY, H:mm:ss')}` + delim +
    `${msg.orderId}`
  );
};

function printTicker(ticker: Ticker, quotePrec: number = 2) {
  return `${chalk.dim('Price: ')}${chalk.bold.white(truncate(padfloat(ticker.price, 10, quotePrec)))}${chalk.dim(' | Bid: ' + padfloat(ticker.bid, 10, quotePrec))}` +
    `${chalk.dim(' | Ask: ' + padfloat(ticker.ask, 10, quotePrec) + ' | sequence: ' + (ticker.trade_id ? ticker.trade_id : 'N/A'))}`;
}

function padString(str: string, size: number): string {
  return size - str.length > 0 ? str + new Array(size - str.length + 1).join(' ') : str;
}

function truncate(str: string, prec: number = 2) {
  let [integer, decimal] = str.split('.');
  return integer.concat('.', decimal.slice(0,2));
}




