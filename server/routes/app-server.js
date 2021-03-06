/* restful api for mobile & web app
*  session用不上，需要改变验证方式
*/
var express = require('express');
var router = express.Router();

var appUser = require('../models/appUser.js');
var companyModel = require('../models/company.js');
var invitations = require('../models/tests.js');
// var invitations = require('../models/invitations.js');
var qr = require('qr-image');
var fs = require("fs");
var ObjectID = require('mongodb').ObjectID;

// 保存二维码身份图片
function file(name) {
    return fs.createWriteStream('../public/img/' + name);
}

// app:注册,[todo:短信注册]
router.post('/reg', function (req, res) {
	var username = req.body.username;
	var password = req.body.password;
	var tel = req.body.tel;
	var company = req.body.company;

	companyModel.findByName(company, function (err, doc) {
		if (doc && doc.length > 0) {
			// 身份暂未设置
			var uobj = {
				username: username,
				password: password,
				tel: tel,
				company: doc[0]._id
			};
			var user = new appUser(uobj);
			console.log('user:' + user);
			// 二维码内容待究
			var ustr = JSON.stringify(uobj);
			user.save(function (err, doc) {
				console.log('save:' + doc);
				if (doc) {
					// 生成二维码名片,默认为png
					qr.image(ustr, { type: 'png', ec_level: 'Q', parse_url: false, margin: 1 })
						.pipe(file(doc._id + '.png'));
					// 获取融云token
					console.log('获取融云token开始...id:'+doc._id +' username:'+ doc.username);
					appUser.getRongyunToken(doc._id,doc.username,'http://yipeng.info/public/img/favicon.ico',
					function(token){
						console.log('token:'+ token);
						user.update({rongyunToken: token }, null);
					});
				}
				res.json({ err: err, info: doc });
			});
		}
	});
});

// app login [短信登录 &&　用户名＼密码登录]
router.post('/login', function (req, res) {
	var username = req.body.username;
	var password = req.body.password;

	appUser.login(username, password, function (err, user) {
		res.json({ user: user });
	});
});

// app 邀访
router.post('/invite', function (req, res) {

	// 测试：创建一家公司
	//var cmodel = new companyModel({ name:'hyd',location:'xxx' });
	//cmodel.save(function(err,doc){
	//	console.log('csaveu:'+doc);
	// });
	// from[uuid]

	var from = req.body.from;
	var address = req.body.address;
	var datetime = req.body.datetime;
	var details = req.body.details;

	// 需要重新计算
	var to = req.body.realname;
	var company = req.body.company;

	//console.log('to:'+to); 效率较低
	appUser.findByCompanyAndName(to, '', function (err, doc) {
		//console.log('u:'+doc);
		if (doc && doc.length > 0) {
			to = doc[0]._id;
			companyModel.findByName(company, function (err, doc) {
				//console.log('c:'+doc);
				if (doc && doc.length > 0) {
					company = doc[0]._id;
					var invite = new invitations({
						from: from,
						to: to,
						company: company,
						datetime: datetime,
						address: address,
						details: details
					});
					invite.save(function (err, doc) {
						res.json({ err: err, info: doc[0] });
					});
				}
			});
		}
	});

	//.populate('company')
	/* 	appUser.findByCompanyAndName(to,company,function(err,doc){
			to = doc[0]._id;
			company.findByName(company, function(err,doc){
				company=doc._id;
				var invite = new invitations({ from:from,to:to,company:company,datetime:datetime,address:address,details:details});
				invite.save(function(err,doc){
					res.json({err: err,info:doc[0]});
				});
			});
	}); */
});

// 获取所有访问user的人
router.post('/user/bevisited', function (req, res) {

	var userid = req.body.userid;
	console.log('invitations' + userid);

	/* 方式1 */
	invitations.find({ to: new ObjectID(userid) })
		.populate('from to company', '-_id')
		.exec(function (err, doc) {
			console.log('populatedDocs:' + doc[0]);
			res.json(doc);
		});

	/* 方式2
	 invitations.find({to:new ObjectID(userid)},function(err,doc){
		var opts = [{
            path : 'from to company'
        }];
        invitations.populate(doc, opts, function(err, populatedDocs) {
		     console.log('populatedDocs:'+populatedDocs);
             console.log(populatedDocs[0].from.name);
			 console.log(populatedDocs[0].to.name);
			 console.log(populatedDocs[0].company.name);
        });
	});*/
});


// 获取所有user访问的人
router.post('/user/visit', function (req, res) {
	var userid = req.body.userid;
	try {
		invitations.find({ from: new ObjectID(userid) })
			.populate('from to company', '-_id')
			.exec(function (err, doc) {
				console.log('populatedDocs:' + doc[0]);
				res.json(doc);
			});
	}
	catch (err) {
		res.json({ err: '服务器查询错误。' });
	}
});


// 获取邀访列表
router.get('/user/search', function (req, res) {
	//　访问信息
	var company = req.query.company;
	var username = req.query.username;
	appUser.findByCompanyAndName(username, company, function (err, doc) {
		res.json(doc);
	});
});

// 用户头像上传
router.post('/user/imgupload', function (req, res) {
	var userid = req.body.userid;
	var imgData = req.body.imgData;
	console.log('上传中:' + userid);
	// 过滤data:URL,已经在前端过滤
	//var base64Data = imgData.replace(/^data:image\/\w+;base64,/, "");
	var dataBuffer = new Buffer(imgData, 'base64');
	// 头像存储路径[相对路径]
	var imgPath = '../public/headimg/' + userid + '.png';
	console.log('上传中(path):' + imgPath);
	fs.writeFile(imgPath, dataBuffer, function (err) {
		if (err) {
			res.send(err);
			console.log(err);
		} else {
			res.send("保存成功！");
			console.log("保存成功！");
		}
	});
});

// 公司搜索
router.get('/company/search', function (req, res) {
	//　访问公司
	var company = req.query.company;
	companyModel.findByName(company, function (err, doc) {
		res.json(doc);
	});
});

// 获取被邀访列表
router.post('/beinvitedlist/:role', function (req, res) {
	var username = req.params.role;
	var userid = req.body.userid;
});

// 及时提醒服务[位置]
router.post('/remind/position/:role', function (req, res) {
	var username = req.params.role;
	var userid = req.body.userid;
});

// 及时提醒服务[时间]
router.post('/remind/time/:role', function (req, res) {
	var username = req.params.role;
	var userid = req.body.userid;
});

// 个人设置服务
router.post('/setting/:role', function (req, res) {
	var username = req.params.role;
	var userid = req.body.userid;
});


// 统计计数服务

module.exports = router;
