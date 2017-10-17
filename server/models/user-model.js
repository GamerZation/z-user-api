const mongoose  = require('mongoose');
const Schema    = mongoose.Schema;
const _         = require('lodash');
const bcrypt    = require('bcrypt');
const validator = require('validator');
const jwt       = require('jsonwebtoken');
const config    = require('./../config/config')
const ObjectId  = Schema.Types.ObjectId;



var UserSchema = new Schema({
  first_name : {
    type: String,
    required : false
  },
  last_name : {
    type: String,
    required : false
  },
  email: {
    type: String,
    required : true,
    unique : true,
    validate : {
      validator : validator.isEmail,
      message  : '{VALUE} is not valid email'
    }
  },
  password : {
    type: String,
    required : true,
    minlenght: 6
  },
  teams : [{
    team_id : ObjectId,
    role  : String,
    _id : false
  }],
  bio : {
    type: String,
    required : false
  },
  age : {
    type : Number,
    required : false
  },
  platform : {
    type : String,
    required : false,
    enum : ['psn','xboxlive']
  },
  region : {
    type : String,
    required : false
  },
  tokens : [{
    os : {
      type: String,
      required: false,
      enum : ['web']
    },
    token : {
      type: String,
      required: false
    }
  }],
  updated_at : {
    type : Date
  },
  created_at : {
    type : Date
  }
});

// MIDDLEWARE -- PRE SAVE-UPDATE-DELETE
// SETTING PASSWORD --- HASHING
UserSchema.pre('save',function (next) {
  var user = this;
  if (user.isModified('password')) {
    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(user.password, salt, (err, hash) => {
        user.password = hash;
        next();
      })
    })
  }else{
    next();
  }
})
// setting dates
UserSchema.pre('save',function (next) {
  var user = this;
  var now  = new Date();
  user.updated_at = now;
  if ( !user.created_at ) {
    user.created_at = now;
    next();
  }else{
    next();
  }
})
UserSchema.pre('update',function (next) {
  var user = this;
  var now  = new Date();
  user.updated_at = now;
  if ( !user.created_at ) {
    user.created_at = now;
    next();
  }else{
    next();
  }
})
UserSchema.pre('update',function (next) {
  var user = this;
  if (user.isModified('password')) {
    bcrypt.genSalt(10, (err, salt) => {
      bcrypt.hash(user.password, salt, (err, hash) => {
        user.password = hash;
        next();
      })
    })
  }else{
    next();
  }
})

// CLASS METHODS (STATICS)
UserSchema.statics.validateUser = function({email,password}) {
  var User = this;

  return User.findOne({email}).then((user) => {
    if (!user) {
      return Promise.reject();
    }
    return new Promise((resolve, reject) => {
      bcrypt.compare(password.toString(), user.password, (err, res) => {
        if (res) {
          resolve(user);
        } else {
          reject({message: 'Wrong password',status : '400'});
        }
      });
    });
  })
};

UserSchema.statics.findByToken = function(token) {
  var user = this;
  try {
    var decoded = jwt.verify(token, config.JWT_SECRET);
  } catch(err) {
    return Promise.reject();
  }
  return user.findOne({
    _id : decoded._id,
    'tokens.token' : token
  })
}

UserSchema.statics.updateUserInfo = function(userData) {
  var User = this;
  var options = {_id , email , first_name , last_name, password} = userData;
  return User.findOneAndUpdate({_id},options)
  .then(doc => {
    return _.pick(options ,['email','first_name','last_name']);
  }).catch(e => {
    return Promise.reject(e);
  })
}
UserSchema.statics.assignTeam = function(teamData,role) {
  var User = this;
  return User.findOne({ _id : teamData.creator_id })
  .then(user => {
    user.teams.push({ team_id : teamData._id , role : role })
    return user.save()
    .then(updated_user => {
      return teamData;
    }, e => {
      return Promise.reject(e);
    })
  }, e => {
    return Promise.reject(e);
  })
}
UserSchema.statics.addTeam = function(team_id, user_id) {
  var User = this;
  return User.findOneAndUpdate({ _id : user_id }, { $push : {
    teams: { team_id } }
  }, { upsert : true  })
  .then(savedUser => {
    return savedUser;
  })
  .catch(e => {
    return Promise.reject(e);
  })
}

UserSchema.statics.removeTeam = function(team_id, user_id) {
  var User = this;
  return User.findOneAndUpdate({_id : user_id} , { $pull : {
    teams : { team_id } }
  })
  .then(savedUser => {
    return savedUser;
  })
  .catch(e => {
    return Promise.reject(e);
  })
}
// INSTANCE METHODS (METHODS)
UserSchema.methods.generateAuthToken = function() {
  var user = this;
  var token = jwt.sign({ _id : user._id.toHexString()}, config.JWT_SECRET);
  user.tokens.push({token : token});
  return user.save().then(savedUser => {
    return token
  });
}

UserSchema.methods.destroySessionToken = function(token) {
  var user = this;
  return user.update({
    $pull: {
      tokens: {token}
    }
  });
}

var UserModel =  mongoose.model('user',UserSchema);


module.exports = mongoose.model('user',UserSchema);;
