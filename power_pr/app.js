require ("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const https = require("https");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const mongoosePaginate = require('mongoose-paginate-v2');
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const app = express();
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));
app.use(session({
    secret: 'little secret',
    resave: false,
    saveUninitialized: true
}))
app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/powerDB", {useNewUrlParser: true});

const userSchema = new mongoose.Schema ({
    email: String,
    password: String,
    
});

userSchema.plugin(passportLocalMongoose); 
const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// User.register({username: "test@email.com"}, process.env.PASSWORD, function(err, user){
//     if (err){
//         console.log(err);
//     } else {
//         passport.authenticate("local")(function(){
//             console.log("success");
//         })
        
//     }
// });
    
const imageSchema = new mongoose.Schema({
    title: String,
    body: String,
    category: String,
    img:
    {
        data: Buffer,
        contentType: String
    }
});

imageSchema.plugin(mongoosePaginate);

const Image = mongoose.model("Image", imageSchema);

Image.paginate();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads')
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now())
    }
});
  
const upload = multer({ storage: storage });



app.get("/", function(req, res, ){
    const mode = "random";
    const url = "https://zenquotes.io/api/" + mode;
    const options = {
        page: 1,
        limit: 2        
      };
    let totalPages = 0;
    https.get(url, function(response){
        response.on("data", function(data){
            const pData = JSON.parse(data);
            const quote_text = pData[0].q;
            const autor = pData[0].a;                             
            Image.paginate({}, options, function (err, result) {
                if (err){
                    console.log(err);
                } else {
                    totalPages = result.totalPages;
                    Image.find({category: {$ne: null}}, (err, ress)=> {
                        if (err){
                            console.log(err);
                        } else {
                            let arr = [];
                            ress.forEach(function(item){
                            arr.push(item.category)
                            })                    
                            let uniqueCategory = Array.from(new Set(arr));                   
                            //console.log(result[0].category, result[1].category,);
                            res.render("index", {q: quote_text, a: autor, queryResult: uniqueCategory, items: result.docs, totalPages: totalPages})
                        }
                    })        
                }
            }) 
        })  
    })
})   

app.get("/page/:pageId", (req,res) => {
    const mode = "random";
    const url = "https://zenquotes.io/api/" + mode;
    const requestedPageId = req.params.pageId;
    const options = {
        page: requestedPageId,
        limit: 6       
      };
    let totalPages = 0;
    https.get(url, function(response){
        response.on("data", function(data){
            const pData = JSON.parse(data);
            const quote_text = pData[0].q;
            const autor = pData[0].a; 
                Image.paginate({}, options, function (err, result) {
                    if (err){
                        console.log(err);
                    } else {
                        totalPages = result.totalPages;
                        Image.find({category: {$ne: null}}, (err, ress)=> {
                            if (err){
                                console.log(err);
                            } else {
                                let arr = [];
                                ress.forEach(function(item){
                                arr.push(item.category)
                                })                    
                                let uniqueCategory = Array.from(new Set(arr));                   
                                //console.log(result[0].category, result[1].category,);
                                res.render("index", {q: quote_text, a: autor, queryResult: uniqueCategory, items: result.docs, totalPages: totalPages})
                            }
                        }) 
                    }
                })   
        })
    })

});

app.get("/logout", function(req, res){
    req.logout(function(err){
        if (err){
            console.log(err)
        } else {
            console.log("logout")
            res.redirect("/");
        }
    });
    
});

app.get("/login", function(req, res){
    res.render("login");
         
    })

app.post("/login", passport.authenticate("local"),function (req, res) {
        console.log("login")
        res.redirect("/compose");
            
    });

   
app.route('/compose') 
    
    .get(function (req, res) {
        if (req.isAuthenticated()){
            console.log("auth");
            const options = {
                page: 1,
                limit: 100        
            };
            let totalPages = 0;
    
            Image.paginate({}, options, function (err, result) {
                if (err){
                    console.log(err);
                } else {
                    totalPages = result.totalPages;
                    res.render("compose", {items: result.docs, totalPages: totalPages})        
                }                
            })  

        } else {
            console.log("redirecting")
            res.redirect("/login");
        }
        
    })

    .post(upload.single('image'), function(req, res) {
        if (req.isAuthenticated()){
            const obj = {
                title: req.body.title,
                body: req.body.body,
                category: req.body.category,
                img: {
                    data: fs.readFileSync(path.join(__dirname + '/uploads/' + req.file.filename)),
                    contentType: 'image/png'
                }
            }
            Image.create(obj, (err, item) => {
                if (err) {
                    console.log(err);
                }
                else {
                    item.save();
                    res.redirect('/compose');
                }
            })
        } else {
            res.redirect("/login");
        }
    
        
    });


app.post("/search", function(req, res){
    const requestedQuery = req.body.search;
    Image.find({title: { "$regex": requestedQuery, "$options": "i" }}, function(err, queryResult){
        if (err){
            console.log(err);
        } else {                  
            res.render("search", {queryResult: queryResult});          
        } 
    })

});


app.post("/categories/:request", function(req, res){
    
    const requestedQuery = req.params.request;
    console.log(requestedQuery);
    Image.find({category: { "$regex": requestedQuery, "$options": "i" }}, function(err, queryResult){
        if (err){
            console.log(err);
        } else {
            res.render("search", {queryResult: queryResult})
        }
    })
});

app.get("/quotes", function(req, res){
    Image.find({}, (err, items) => {
            if (err) {
                console.log(err);
                res.status(500).send('An error occurred', err);
            }
            else {
                res.render('quotes', { items: items });
            }
        });
    
});

app.get("/articles/:articleId", function (req, res) {
  
    const requestedArticleId = req.params.articleId;
  
    Image.findOne({_id: requestedArticleId}, function(err, article){
        if (!err) {
            res.render("article", { 
                title: article.title, 
                body: article.body,
                contentType: article.img.contentType,
                data: article.img.data
            });
        }
    });
  });

  app.get("/edit/:articleId", function(req, res) {
    const requestedArticleId = req.params.articleId;
    Image.findOne({_id: requestedArticleId}, function(err, article){
        if (!err) {
            res.render("edit", { 
                title: article.title, 
                body: article.body,
                category: article.category,
                contentType: article.img.contentType,
                data: article.img.data,
                id: article._id
            });
        }
    });
  })

  app.post("/edit/:articleId", upload.single('image'), function(req, res){
    if (req.isAuthenticated()){
        const requestedArticleId = req.params.articleId;

        const filter = {_id: requestedArticleId};
        console.log(req.file.filename)
        const update = {
                title: req.body.title,           
                body: req.body.body,
                category: req.body.category,
                
        } 
        Image.findOneAndUpdate(filter, update, {new: true}, function(err, article) {
            if (!err){
                res.render("article", {
                    title: article.title, 
                    body: article.body,
                    category: article.category,
                    contentType: article.img.contentType,
                    data: article.img.data
                })
            }
        })
    } else {
        res.redirect("/login");
    }
    
});

app.get("/delete/:articleId", function(req, res){
    if (req.isAuthenticated()){
        const requestedArticleId = req.params.articleId;    
        Image.findByIdAndRemove({_id: requestedArticleId}, function(err){
                if (!err){
                    console.log("success");
                            
                } else {
                    console.log(err)
                }
            });
        res.redirect("/compose");
    } else {
        res.redirect("/login");
    }
    
});



app.listen(3000, function(){
    console.log("server started");
});