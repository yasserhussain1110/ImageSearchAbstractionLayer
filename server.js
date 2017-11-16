const express = require('express');
const axios = require('axios');
const MongoClient = require('mongodb').MongoClient;
const app = express();

if (process.env.NODE_ENV !== "production") {
  require('dotenv').config();
}

const {BING_SUBSCRIPTION_KEY, DATABASE_URL} = process.env;

app.use(express.static('public'));

app.get('/api/imagesearch/:searchTerm', (req, res) => {
  const searchTerm = req.params.searchTerm;
  const offset = req.query.offset || 0;
  const bingSearchURL = createBingSearchURL(searchTerm, offset);
  console.log(bingSearchURL);
  axios.get(bingSearchURL, {
    headers: {
      'Ocp-Apim-Subscription-Key': BING_SUBSCRIPTION_KEY
    }
  }).then(result => {
    const sanitizedResponse = sanitizeSearchResponse(result.data.value);
    res.json(sanitizedResponse);
    insertSearchTermInDB(searchTerm);
  }).catch(e => {
    console.log(e);
    res.status(400).send();
  });
});

app.get('/api/latest/imagesearch', (req, res) => {
  sendLatestSearchItems(res);
});

const createBingSearchURL = (searchTerm, offset) =>
  `https://api.cognitive.microsoft.com/bing/v7.0/images/search?q=${searchTerm}&count=20&offset=${offset}`;

const sanitizeSearchResponse = results =>
  results.filter(r => {
    return r.thumbnailUrl && r.contentUrl && r.hostPageUrl;
  }).map(r => ({
    url: r.contentUrl,
    context: r.hostPageUrl,
    thumbnail: r.thumbnailUrl
  }));

const insertSearchTermInDB = searchTerm => {
  MongoClient.connect(DATABASE_URL).then(db => {
    db.collection('customsearch').insertOne({searchTerm})
      .catch(e => {
        console.log(e);
      })
      .then(() => {
        db.close();
      });
  }).catch(e => {
    console.log(e);
  });
};

const sendLatestSearchItems = res => {
  MongoClient.connect(DATABASE_URL).then(db => {
    db.collection('customsearch').find().sort({_id: -1}).limit(10).toArray().then(searchTermDocs => {
      const sanitizedData = searchTermDocs.map(doc => ({
        searchTerm: doc.searchTerm,
        when: doc._id.getTimestamp()
      }));
      res.json(sanitizedData);
    }).catch(e => {
      console.log(e);
    }).then(() => {
      db.close();
    });
  }).catch(e => {
    console.log(e);
  });
};

app.listen(process.env.PORT || 8080);
