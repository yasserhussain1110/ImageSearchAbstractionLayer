require('dotenv').config();
var express = require('express');
var https = require('https');
var mongo = require('mongodb').MongoClient;
var app = express();

/*
 https://www.googleapis.com/customsearch/v1element?
 key=AIzaSyCVAXiUzRYsML1Pv6RwSG1gunmMikTzQqY&rsz=filtered_cse&num=20&hl=en&
 prettyPrint=false&source=gcsc&gss=.com&sig=0c3990ce7a056ed50667fe0c3873c9b6&searchtype=image&
 cx=009771908109930493698:nmxgafxmozu&q=cats&googlehost=www.google.com
 */


// https://www.googleapis.com/customsearch/v1element?key=AIzaSyCVAXiUzRYsML1Pv6RwSG1gunmMikTzQqY&num=10&start=0&
// hl=en&searchtype=image&cx=009771908109930493698:nmxgafxmozu&q=cats

var dbUrl = process.env.DATABASE_URL || "mongodb://localhost:27017/yasser";

app.use(express.static('public'));

app.get('/api/latest/imagesearch', function (req, res) {
  sendLatestSearchItems(res);
});

app.get('/api/imagesearch/:searchTerm', function (req, res) {
  var searchTerm = req.params.searchTerm;
  var offset = req.query.offset || "";
  var customSearchUrl = makeCustomSearchUrl(searchTerm, offset);

  https.get(customSearchUrl, function (apiRes) {
    var apiResponse = "";
    apiRes.setEncoding('utf8');
    apiRes.on('data', function (chunk) {
      apiResponse += chunk;
    });
    apiRes.on('end', function () {
      sendResponse(JSON.parse(apiResponse), res);
      insertInDB(searchTerm);
    });
  }).on('error', function (err) {
    console.log("Got an error.");
    console.log(err);
  });
});

function sendLatestSearchItems(res) {
  mongo.connect(dbUrl, function (err, db) {
    const customSearch = db.collection("custom_search");
    customSearch.find().sort({_id: -1}).limit(10).toArray(function (err, docs) {
      res.json(
        docs.map(function (doc) {
          return {
            searchTerm: doc.searchTerm,
            when: doc._id.getTimestamp()
          }
        }));
    });
  });
}

function insertInDB(searchTerm) {
  mongo.connect(dbUrl, function (err, db) {
    const customSearch = db.collection("custom_search");
    customSearch.insert({searchTerm: searchTerm}, function (err, data) {
      if (err) {
        console.log("Error in inserting.");
      } else {
        console.log(searchTerm + " inserted.");
      }
      db.close();
    });
  });
}

function sendResponse(googleSearchResult, response) {
  if (googleSearchResult && googleSearchResult.results) {
    response.json(
      googleSearchResult.results.map(function (foundResult) {
        return {
          url: foundResult.url,
          context: foundResult.originalContextUrl,
          snippet: foundResult.contentNoFormatting,
          thumbnail: foundResult.tbUrl
        };
      }));
  }
}

function adjustOffset(offset) {
  // offset should always be a multiple of 10
  return Math.floor(offset / 10) * 10;
}


function makeCustomSearchUrl(searchTerm, offset) {
  return "https://www.googleapis.com/customsearch/v1element?prettyPrint=false&hl=en&searchtype=image&num=10&"
    + "key=" + process.env.key + "&"
    + "cx=" + process.env.cx + "&"
    + (offset ? "start=" + adjustOffset(offset) + "&" : "")
    + "q=" + searchTerm;
}

app.listen(process.env.PORT || 8080);

