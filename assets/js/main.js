angular.module('restaurants', [])

/** Application constants */
.constant('APPLICATION_ID', 'CYNTXLR4V5')
.constant('API_KEY', 'f7ccd1bec7ee529855fad1449648d653')
.constant('INDEX_NAME', 'restaurants')

.service('GetGeoOption', function($log, $q) {
  var deferred = $q.defer();
  return function () {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(function (position) {
        $log.log("Using browser coordinates");
        deferred.resolve(position.coords.latitude + ',' + position.coords.longitude);
      }, function (error) {
        $log.log("Falling back to IP address");
        deferred.resolve(false);
      });
    } else {
      $log.log("Falling back to IP address");
      deferred.resolve(false);
    }
    return deferred.promise;
  }
})

/** Algolia search service **/
.service('AlgoliaSearch', function (APPLICATION_ID, API_KEY, INDEX_NAME, $q, GetGeoOption) {
  var self = this, deferred,
      client = algoliasearch(APPLICATION_ID, API_KEY),
      helper = algoliasearchHelper(client, INDEX_NAME, {
        disjunctiveFacets: ['food_type', 'stars_count', 'payment_options']
      });

  self.setQuery = setQuery;
  self.toggleRefinement = toggleRefinement;
  self.nextPage = nextPage;
  self.addStarFilter = addStarFilter;
  self.clearRefinements = clearRefinements;
  
  var geoFetched = false;

  // set geo searching
  function getGeo() {
    return GetGeoOption().then(function (position) {
      if (geoFetched) return;
      if (position)
        helper.setQueryParameter('aroundLatLng', position);
      else
        helper.setQueryParameter('aroundLatLngViaIP', true);
      geoFetched = true;
    });
  }

  // resolve deferred promise on result
  helper.on('result', function (content) {
    deferred.resolve(content);
  });

  // wraps setQuery in a promise
  function setQuery(query) {
    return getGeo().then(function () {
      deferred = $q.defer();
      helper.setQuery(query).search();
      return deferred.promise;
    })
  }

  // toggleRefinement
  function toggleRefinement(facet, value) {
    deferred = $q.defer();
    helper.toggleRefinement(facet, value).search();
    return deferred.promise;
  }

  // next page
  function nextPage() {
    deferred = $q.defer();
    helper.nextPage().search();
    return deferred.promise;
  }

  // add star filter
  function addStarFilter(star) {
    deferred = $q.defer();
    helper.removeNumericRefinement('stars_count');
    if (angular.isUndefined(star)) {
      helper.search();
      return deferred.promise;
    }

    helper.addNumericRefinement('stars_count', '>=', star)
          .addNumericRefinement('stars_count', '<', star + 1)
          .search();
    return deferred.promise;
  }

  // clear refinements
  function clearRefinements(type) {
    deferred = $q.defer();
    helper.clearRefinements(type).search();
    return deferred.promise;
  }
})


/** Main Search Controller **/
.controller('SearchController', function(AlgoliaSearch, $timeout) {
  var self = this;

  self.setQuery = setQuery;
  self.toggleRefinement = toggleRefinement;
  self.calcStarsWidth = calcStarsWidth;
  self.nextPage = nextPage;
  self.addStarFilter = addStarFilter;
  self.clearRefinements = clearRefinements;

  self.isRefined = {};
  self.viewMoreFoodTypes = viewMoreFoodTypes;
  self.viewMoreFoodTypeButtonText = 'Show more';
  self.foodTypeLimit = 10;
  
  // initialize empty query
  setQuery();

  function setQuery(query) {
    AlgoliaSearch.setQuery(query).then(updateView);
  }

  function toggleRefinement(facet, value, view) {
    AlgoliaSearch.toggleRefinement(facet, value).then(updateView);
    self.isRefined[facet] = true;
  }

  // unlike other functions, just concats new results to current
  function nextPage() {
    AlgoliaSearch.nextPage().then(function (content) {
      self.results = self.results.concat(content.hits);
    })
  }

  function addStarFilter(star) {
    if (self.starFilter === star) star = undefined;
    AlgoliaSearch.addStarFilter(star).then(updateView);
    self.starFilter = star;
  }

  function clearRefinements(type) {
    AlgoliaSearch.clearRefinements(type).then(updateView);
    self.isRefined[type] = false;
  }

  // utility function to update results, stats, and facets
  function updateView(content) {
    self.results = content.hits;
    setStats(content);
    setFacets(content);
  }

  function setStats(content) {
    // number of hits
    self.totalHits = content.nbHits;
    // search time in seconds
    self.searchTime = content.processingTimeMS / 1000;
  }

  function setFacets(content) {
    self.foodTypes = content.getFacetValues('food_type');
    self.foodTypeLimit = Math.min(self.foodTypes.length, 10);
    self.paymentTypes = content.getFacetValues('payment_options');
  }

  function viewMoreFoodTypes() {
    if (self.foodTypeLimit === 10) {
      self.foodTypeLimit = self.foodTypes.length;
      self.viewMoreFoodTypeButtonText = 'Show less';
    } else {
      self.foodTypeLimit = Math.min(self.foodTypes.length, 10);
      self.viewMoreFoodTypeButtonText = 'Show more';
    }
  }

  // calculates width of stars for rating, taking into account
  // partial stars + gaps between stars
  function calcStarsWidth(rating) {
    let starWidth = 16.5, gap = 2.5;
    let wholeStars = Math.floor(rating);
    let partialStar = rating - wholeStars;
    return (wholeStars * (starWidth + gap)) + (partialStar * starWidth) + 'px';
  }
})
