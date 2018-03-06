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

The simplest way is to `npm install -g ts-node`. Then just run the script directly using `ts-node trade commmand [options]`.

If you want to run using node, you can `npm install -g typescript` and then run `tsc` in the same folder as the `tsconfig.json` file. This will generate `trade.js` in the `build/` folder. Then just run `node trade command [options]`.

Once you have the app running with either method you can type `node trade --help` to get a full list of available commands. You can also type `node trade buy --help` to see the options for a specific command. 

### Environment Variables

In order to use any of the account specific featues such as listing open orders, you will need to be authenticated. The script looks for the following environment variables to authenticate with the GDAX API.

`GDAX_KEY`
`GDAX_SECRET`
`GDAX_PASSPHRASE`

Make sure these are set in your environment, or you can add a `.env` file to your root folder and the script will pull them from there instead. 

### Docker

`Dockerfile` and `docker-compose.yml` files are provided to automate the build process. Simply run `docker build -t trader .` to build the image and then `docker-compose up` to start the build. Essentially the first container installs yarn and downloads the dependencies, and the second container does the typescript precompile step. 

If you don't want to build the image yourself you can also `docker pull sfkiwi/trader:latest`.

### Persisting Logging files with Docker

By default the docker container runs the live account orders feed and outputs order Messages to `logs/orders.csv`. If you want to run the container on a cloud provider such as Amazon the easiest way is to ssh into your instance and `docker pull sfkiwi/trader:latest`. Then run `docker run -e "GDAX_KEY=<your key>" -e "GDAX_SECRET=<your secret>" -e "GDAX_PASSPHRASE=<your passphrase>" -v ~/:/app/logs sfkiwi/trader:latest`. Insert your GDAX API credentials (leaving out the <> brackets). The -v option will mount the container's logs/ director to your host so that the orders.csv is not lost if the container is terminated. 