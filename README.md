# Trader

## Description

Simple Commandline trading companion that uses the GDAX Trading Toolkit API. 

## Features

- Place/Cancel Orders: Simple shorthand commands for placing market or limit buy and sell orders.

`node trade b 0.5 l 12400`

places a limit buy order for 0.5 BTC at $12,400

- Get the Price Ticker: Shows current price, big and ask as a visual indicator (SMA5) to show how fast the price is moving

`node trade ticker`

- See all current open orders

`node trade orders ls`

- Account Orders live feed: Get updates whenever a trade is placed, executed or canceled on your own account 

`node trade orders live`

## Instructions

### Typescript

The simplest way is to `npm install - g ts-node`. Then just run the script directly using `ts-node trade commmand [options]`.

If you want to run using node, you can `npm install -g typescript` and then run `tsc` in the same folder as the `tsconfig.json` file. This will generate `trade.js` in the `build/` folder. Then just run `node trade command [options]`.

Once you have the app running with either method you can type `node trade --help` to get a full list of available commands. You can also type `node trade buy --help` to see the options for a specific command. 

### Docker

`Dockerfile` and `docker-compose.yml` files are provided to automate the build process. Simply run `docker build -t trader .` to build the image and then `docker-compose up` to start the build. Essentially the first container installs yarn and downloads the dependencies, and the second container does the typescript precompile step. 

If you don't want to build the image yourself you can also `docker pull sfkiwi/trader:latest`.

### Environment Variables

In order to use any of the account specific featues such as listing open orders, you will need to be authenticated. The script looks for the following environment variables to authenticate with the GDAX API.

`GDAX_KEY`
`GDAX_SECRET`
`GDAX_PASSPHRASE`

Make sure these are set in your environment, or you can add a `.env` file to your root folder and the script will pull them from there instead. 