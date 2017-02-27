"use strict";
require('dotenv').config();

// fetches ADMIN_API_KEY from .env file not tracked in Git repository
const APPLICATION_ID = process.env.APPLICATION_ID;
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

const fs = require('fs');
const parse = require('csv-parse');
const algoliasearch = require('algoliasearch');
const client = algoliasearch(APPLICATION_ID, ADMIN_API_KEY);
const index = client.initIndex('restaurants');

// read restaurant JSON objects from .json
let restaurants = require('./resources/dataset/restaurants_list.json');

// function to add restaurants to Algolia index
let addRestaurants = restaurants => {
  index.addObjects(restaurants, (err, content) => {
    if (err) console.error(err);
  });
}

// transform Diners Club and Carte Blanche to Discover, and strip out
// other payment types
let paymentTypes = ['AMEX', 'Visa', 'Discover', 'MasterCard'];
let cleanPayments = restaurant => {
  restaurant.payment_options = 
    restaurant.payment_options.map(payment => {
      if (payment === 'Diners Club' || payment === 'Carte Blanche')
        return 'Discover';
      return payment;
    }).filter(payment => paymentTypes.indexOf(payment) > -1);
}

let infoMap = {};
let csvOptions = {
      delimiter: ';',
      columns: true,
      auto_parse: true
    };

// read additional JSON info from .csv
let parser = parse(csvOptions, (err, data) => {
  if (!data) return;
  // map IDs to info object
  data.forEach(row => infoMap[row.objectID] = row);
  // merge with restaurants, clean up payment types
  restaurants.forEach(restaurant => {
    Object.assign(restaurant, infoMap[restaurant.objectID]);
    cleanPayments(restaurant);
  });
  // push to Algolia
  addRestaurants(restaurants);
});

fs.createReadStream('resources/dataset/restaurants_info.csv').pipe(parser);
