import { app, ipcMain, dialog, shell, BrowserWindow } from "electron";
import Database from "better-sqlite3";
import path$3 from "path";
import nodeCrypto from "crypto";
import fs from "fs";
import require$$2 from "util";
import require$$0$2 from "events";
import require$$0$1 from "child_process";
import require$$1 from "os";
import require$$3 from "stream";
import http from "http";
import url from "url";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path$4 from "node:path";
import fs$1 from "node:fs";
const dbPath = path$3.join(app.getPath("userData"), "database.sqlite");
const db = new Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    hint TEXT
  );
  
  CREATE TABLE IF NOT EXISTS fragments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    source_url TEXT,
    file_path TEXT,
    drive_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);
var randomFallback = null;
function randomBytes(len) {
  try {
    return crypto.getRandomValues(new Uint8Array(len));
  } catch {
  }
  try {
    return nodeCrypto.randomBytes(len);
  } catch {
  }
  if (!randomFallback) {
    throw Error(
      "Neither WebCryptoAPI nor a crypto module is available. Use bcrypt.setRandomFallback to set an alternative"
    );
  }
  return randomFallback(len);
}
function setRandomFallback(random) {
  randomFallback = random;
}
function genSaltSync(rounds, seed_length) {
  rounds = rounds || GENSALT_DEFAULT_LOG2_ROUNDS;
  if (typeof rounds !== "number")
    throw Error(
      "Illegal arguments: " + typeof rounds + ", " + typeof seed_length
    );
  if (rounds < 4) rounds = 4;
  else if (rounds > 31) rounds = 31;
  var salt = [];
  salt.push("$2b$");
  if (rounds < 10) salt.push("0");
  salt.push(rounds.toString());
  salt.push("$");
  salt.push(base64_encode(randomBytes(BCRYPT_SALT_LEN), BCRYPT_SALT_LEN));
  return salt.join("");
}
function genSalt(rounds, seed_length, callback) {
  if (typeof seed_length === "function")
    callback = seed_length, seed_length = void 0;
  if (typeof rounds === "function") callback = rounds, rounds = void 0;
  if (typeof rounds === "undefined") rounds = GENSALT_DEFAULT_LOG2_ROUNDS;
  else if (typeof rounds !== "number")
    throw Error("illegal arguments: " + typeof rounds);
  function _async(callback2) {
    nextTick(function() {
      try {
        callback2(null, genSaltSync(rounds));
      } catch (err) {
        callback2(err);
      }
    });
  }
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
function hashSync(password, salt) {
  if (typeof salt === "undefined") salt = GENSALT_DEFAULT_LOG2_ROUNDS;
  if (typeof salt === "number") salt = genSaltSync(salt);
  if (typeof password !== "string" || typeof salt !== "string")
    throw Error("Illegal arguments: " + typeof password + ", " + typeof salt);
  return _hash(password, salt);
}
function hash(password, salt, callback, progressCallback) {
  function _async(callback2) {
    if (typeof password === "string" && typeof salt === "number")
      genSalt(salt, function(err, salt2) {
        _hash(password, salt2, callback2, progressCallback);
      });
    else if (typeof password === "string" && typeof salt === "string")
      _hash(password, salt, callback2, progressCallback);
    else
      nextTick(
        callback2.bind(
          this,
          Error("Illegal arguments: " + typeof password + ", " + typeof salt)
        )
      );
  }
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
function safeStringCompare(known, unknown) {
  var diff = known.length ^ unknown.length;
  for (var i = 0; i < known.length; ++i) {
    diff |= known.charCodeAt(i) ^ unknown.charCodeAt(i);
  }
  return diff === 0;
}
function compareSync(password, hash2) {
  if (typeof password !== "string" || typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof password + ", " + typeof hash2);
  if (hash2.length !== 60) return false;
  return safeStringCompare(
    hashSync(password, hash2.substring(0, hash2.length - 31)),
    hash2
  );
}
function compare(password, hashValue, callback, progressCallback) {
  function _async(callback2) {
    if (typeof password !== "string" || typeof hashValue !== "string") {
      nextTick(
        callback2.bind(
          this,
          Error(
            "Illegal arguments: " + typeof password + ", " + typeof hashValue
          )
        )
      );
      return;
    }
    if (hashValue.length !== 60) {
      nextTick(callback2.bind(this, null, false));
      return;
    }
    hash(
      password,
      hashValue.substring(0, 29),
      function(err, comp) {
        if (err) callback2(err);
        else callback2(null, safeStringCompare(comp, hashValue));
      },
      progressCallback
    );
  }
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
function getRounds(hash2) {
  if (typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof hash2);
  return parseInt(hash2.split("$")[2], 10);
}
function getSalt(hash2) {
  if (typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof hash2);
  if (hash2.length !== 60)
    throw Error("Illegal hash length: " + hash2.length + " != 60");
  return hash2.substring(0, 29);
}
function truncates(password) {
  if (typeof password !== "string")
    throw Error("Illegal arguments: " + typeof password);
  return utf8Length(password) > 72;
}
var nextTick = typeof setImmediate === "function" ? setImmediate : typeof scheduler === "object" && typeof scheduler.postTask === "function" ? scheduler.postTask.bind(scheduler) : setTimeout;
function utf8Length(string) {
  var len = 0, c = 0;
  for (var i = 0; i < string.length; ++i) {
    c = string.charCodeAt(i);
    if (c < 128) len += 1;
    else if (c < 2048) len += 2;
    else if ((c & 64512) === 55296 && (string.charCodeAt(i + 1) & 64512) === 56320) {
      ++i;
      len += 4;
    } else len += 3;
  }
  return len;
}
function utf8Array(string) {
  var offset = 0, c1, c2;
  var buffer = new Array(utf8Length(string));
  for (var i = 0, k = string.length; i < k; ++i) {
    c1 = string.charCodeAt(i);
    if (c1 < 128) {
      buffer[offset++] = c1;
    } else if (c1 < 2048) {
      buffer[offset++] = c1 >> 6 | 192;
      buffer[offset++] = c1 & 63 | 128;
    } else if ((c1 & 64512) === 55296 && ((c2 = string.charCodeAt(i + 1)) & 64512) === 56320) {
      c1 = 65536 + ((c1 & 1023) << 10) + (c2 & 1023);
      ++i;
      buffer[offset++] = c1 >> 18 | 240;
      buffer[offset++] = c1 >> 12 & 63 | 128;
      buffer[offset++] = c1 >> 6 & 63 | 128;
      buffer[offset++] = c1 & 63 | 128;
    } else {
      buffer[offset++] = c1 >> 12 | 224;
      buffer[offset++] = c1 >> 6 & 63 | 128;
      buffer[offset++] = c1 & 63 | 128;
    }
  }
  return buffer;
}
var BASE64_CODE = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
var BASE64_INDEX = [
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  0,
  1,
  54,
  55,
  56,
  57,
  58,
  59,
  60,
  61,
  62,
  63,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  28,
  29,
  30,
  31,
  32,
  33,
  34,
  35,
  36,
  37,
  38,
  39,
  40,
  41,
  42,
  43,
  44,
  45,
  46,
  47,
  48,
  49,
  50,
  51,
  52,
  53,
  -1,
  -1,
  -1,
  -1,
  -1
];
function base64_encode(b, len) {
  var off = 0, rs = [], c1, c2;
  if (len <= 0 || len > b.length) throw Error("Illegal len: " + len);
  while (off < len) {
    c1 = b[off++] & 255;
    rs.push(BASE64_CODE[c1 >> 2 & 63]);
    c1 = (c1 & 3) << 4;
    if (off >= len) {
      rs.push(BASE64_CODE[c1 & 63]);
      break;
    }
    c2 = b[off++] & 255;
    c1 |= c2 >> 4 & 15;
    rs.push(BASE64_CODE[c1 & 63]);
    c1 = (c2 & 15) << 2;
    if (off >= len) {
      rs.push(BASE64_CODE[c1 & 63]);
      break;
    }
    c2 = b[off++] & 255;
    c1 |= c2 >> 6 & 3;
    rs.push(BASE64_CODE[c1 & 63]);
    rs.push(BASE64_CODE[c2 & 63]);
  }
  return rs.join("");
}
function base64_decode(s, len) {
  var off = 0, slen = s.length, olen = 0, rs = [], c1, c2, c3, c4, o, code;
  if (len <= 0) throw Error("Illegal len: " + len);
  while (off < slen - 1 && olen < len) {
    code = s.charCodeAt(off++);
    c1 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    code = s.charCodeAt(off++);
    c2 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    if (c1 == -1 || c2 == -1) break;
    o = c1 << 2 >>> 0;
    o |= (c2 & 48) >> 4;
    rs.push(String.fromCharCode(o));
    if (++olen >= len || off >= slen) break;
    code = s.charCodeAt(off++);
    c3 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    if (c3 == -1) break;
    o = (c2 & 15) << 4 >>> 0;
    o |= (c3 & 60) >> 2;
    rs.push(String.fromCharCode(o));
    if (++olen >= len || off >= slen) break;
    code = s.charCodeAt(off++);
    c4 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    o = (c3 & 3) << 6 >>> 0;
    o |= c4;
    rs.push(String.fromCharCode(o));
    ++olen;
  }
  var res = [];
  for (off = 0; off < olen; off++) res.push(rs[off].charCodeAt(0));
  return res;
}
var BCRYPT_SALT_LEN = 16;
var GENSALT_DEFAULT_LOG2_ROUNDS = 10;
var BLOWFISH_NUM_ROUNDS = 16;
var MAX_EXECUTION_TIME = 100;
var P_ORIG = [
  608135816,
  2242054355,
  320440878,
  57701188,
  2752067618,
  698298832,
  137296536,
  3964562569,
  1160258022,
  953160567,
  3193202383,
  887688300,
  3232508343,
  3380367581,
  1065670069,
  3041331479,
  2450970073,
  2306472731
];
var S_ORIG = [
  3509652390,
  2564797868,
  805139163,
  3491422135,
  3101798381,
  1780907670,
  3128725573,
  4046225305,
  614570311,
  3012652279,
  134345442,
  2240740374,
  1667834072,
  1901547113,
  2757295779,
  4103290238,
  227898511,
  1921955416,
  1904987480,
  2182433518,
  2069144605,
  3260701109,
  2620446009,
  720527379,
  3318853667,
  677414384,
  3393288472,
  3101374703,
  2390351024,
  1614419982,
  1822297739,
  2954791486,
  3608508353,
  3174124327,
  2024746970,
  1432378464,
  3864339955,
  2857741204,
  1464375394,
  1676153920,
  1439316330,
  715854006,
  3033291828,
  289532110,
  2706671279,
  2087905683,
  3018724369,
  1668267050,
  732546397,
  1947742710,
  3462151702,
  2609353502,
  2950085171,
  1814351708,
  2050118529,
  680887927,
  999245976,
  1800124847,
  3300911131,
  1713906067,
  1641548236,
  4213287313,
  1216130144,
  1575780402,
  4018429277,
  3917837745,
  3693486850,
  3949271944,
  596196993,
  3549867205,
  258830323,
  2213823033,
  772490370,
  2760122372,
  1774776394,
  2652871518,
  566650946,
  4142492826,
  1728879713,
  2882767088,
  1783734482,
  3629395816,
  2517608232,
  2874225571,
  1861159788,
  326777828,
  3124490320,
  2130389656,
  2716951837,
  967770486,
  1724537150,
  2185432712,
  2364442137,
  1164943284,
  2105845187,
  998989502,
  3765401048,
  2244026483,
  1075463327,
  1455516326,
  1322494562,
  910128902,
  469688178,
  1117454909,
  936433444,
  3490320968,
  3675253459,
  1240580251,
  122909385,
  2157517691,
  634681816,
  4142456567,
  3825094682,
  3061402683,
  2540495037,
  79693498,
  3249098678,
  1084186820,
  1583128258,
  426386531,
  1761308591,
  1047286709,
  322548459,
  995290223,
  1845252383,
  2603652396,
  3431023940,
  2942221577,
  3202600964,
  3727903485,
  1712269319,
  422464435,
  3234572375,
  1170764815,
  3523960633,
  3117677531,
  1434042557,
  442511882,
  3600875718,
  1076654713,
  1738483198,
  4213154764,
  2393238008,
  3677496056,
  1014306527,
  4251020053,
  793779912,
  2902807211,
  842905082,
  4246964064,
  1395751752,
  1040244610,
  2656851899,
  3396308128,
  445077038,
  3742853595,
  3577915638,
  679411651,
  2892444358,
  2354009459,
  1767581616,
  3150600392,
  3791627101,
  3102740896,
  284835224,
  4246832056,
  1258075500,
  768725851,
  2589189241,
  3069724005,
  3532540348,
  1274779536,
  3789419226,
  2764799539,
  1660621633,
  3471099624,
  4011903706,
  913787905,
  3497959166,
  737222580,
  2514213453,
  2928710040,
  3937242737,
  1804850592,
  3499020752,
  2949064160,
  2386320175,
  2390070455,
  2415321851,
  4061277028,
  2290661394,
  2416832540,
  1336762016,
  1754252060,
  3520065937,
  3014181293,
  791618072,
  3188594551,
  3933548030,
  2332172193,
  3852520463,
  3043980520,
  413987798,
  3465142937,
  3030929376,
  4245938359,
  2093235073,
  3534596313,
  375366246,
  2157278981,
  2479649556,
  555357303,
  3870105701,
  2008414854,
  3344188149,
  4221384143,
  3956125452,
  2067696032,
  3594591187,
  2921233993,
  2428461,
  544322398,
  577241275,
  1471733935,
  610547355,
  4027169054,
  1432588573,
  1507829418,
  2025931657,
  3646575487,
  545086370,
  48609733,
  2200306550,
  1653985193,
  298326376,
  1316178497,
  3007786442,
  2064951626,
  458293330,
  2589141269,
  3591329599,
  3164325604,
  727753846,
  2179363840,
  146436021,
  1461446943,
  4069977195,
  705550613,
  3059967265,
  3887724982,
  4281599278,
  3313849956,
  1404054877,
  2845806497,
  146425753,
  1854211946,
  1266315497,
  3048417604,
  3681880366,
  3289982499,
  290971e4,
  1235738493,
  2632868024,
  2414719590,
  3970600049,
  1771706367,
  1449415276,
  3266420449,
  422970021,
  1963543593,
  2690192192,
  3826793022,
  1062508698,
  1531092325,
  1804592342,
  2583117782,
  2714934279,
  4024971509,
  1294809318,
  4028980673,
  1289560198,
  2221992742,
  1669523910,
  35572830,
  157838143,
  1052438473,
  1016535060,
  1802137761,
  1753167236,
  1386275462,
  3080475397,
  2857371447,
  1040679964,
  2145300060,
  2390574316,
  1461121720,
  2956646967,
  4031777805,
  4028374788,
  33600511,
  2920084762,
  1018524850,
  629373528,
  3691585981,
  3515945977,
  2091462646,
  2486323059,
  586499841,
  988145025,
  935516892,
  3367335476,
  2599673255,
  2839830854,
  265290510,
  3972581182,
  2759138881,
  3795373465,
  1005194799,
  847297441,
  406762289,
  1314163512,
  1332590856,
  1866599683,
  4127851711,
  750260880,
  613907577,
  1450815602,
  3165620655,
  3734664991,
  3650291728,
  3012275730,
  3704569646,
  1427272223,
  778793252,
  1343938022,
  2676280711,
  2052605720,
  1946737175,
  3164576444,
  3914038668,
  3967478842,
  3682934266,
  1661551462,
  3294938066,
  4011595847,
  840292616,
  3712170807,
  616741398,
  312560963,
  711312465,
  1351876610,
  322626781,
  1910503582,
  271666773,
  2175563734,
  1594956187,
  70604529,
  3617834859,
  1007753275,
  1495573769,
  4069517037,
  2549218298,
  2663038764,
  504708206,
  2263041392,
  3941167025,
  2249088522,
  1514023603,
  1998579484,
  1312622330,
  694541497,
  2582060303,
  2151582166,
  1382467621,
  776784248,
  2618340202,
  3323268794,
  2497899128,
  2784771155,
  503983604,
  4076293799,
  907881277,
  423175695,
  432175456,
  1378068232,
  4145222326,
  3954048622,
  3938656102,
  3820766613,
  2793130115,
  2977904593,
  26017576,
  3274890735,
  3194772133,
  1700274565,
  1756076034,
  4006520079,
  3677328699,
  720338349,
  1533947780,
  354530856,
  688349552,
  3973924725,
  1637815568,
  332179504,
  3949051286,
  53804574,
  2852348879,
  3044236432,
  1282449977,
  3583942155,
  3416972820,
  4006381244,
  1617046695,
  2628476075,
  3002303598,
  1686838959,
  431878346,
  2686675385,
  1700445008,
  1080580658,
  1009431731,
  832498133,
  3223435511,
  2605976345,
  2271191193,
  2516031870,
  1648197032,
  4164389018,
  2548247927,
  300782431,
  375919233,
  238389289,
  3353747414,
  2531188641,
  2019080857,
  1475708069,
  455242339,
  2609103871,
  448939670,
  3451063019,
  1395535956,
  2413381860,
  1841049896,
  1491858159,
  885456874,
  4264095073,
  4001119347,
  1565136089,
  3898914787,
  1108368660,
  540939232,
  1173283510,
  2745871338,
  3681308437,
  4207628240,
  3343053890,
  4016749493,
  1699691293,
  1103962373,
  3625875870,
  2256883143,
  3830138730,
  1031889488,
  3479347698,
  1535977030,
  4236805024,
  3251091107,
  2132092099,
  1774941330,
  1199868427,
  1452454533,
  157007616,
  2904115357,
  342012276,
  595725824,
  1480756522,
  206960106,
  497939518,
  591360097,
  863170706,
  2375253569,
  3596610801,
  1814182875,
  2094937945,
  3421402208,
  1082520231,
  3463918190,
  2785509508,
  435703966,
  3908032597,
  1641649973,
  2842273706,
  3305899714,
  1510255612,
  2148256476,
  2655287854,
  3276092548,
  4258621189,
  236887753,
  3681803219,
  274041037,
  1734335097,
  3815195456,
  3317970021,
  1899903192,
  1026095262,
  4050517792,
  356393447,
  2410691914,
  3873677099,
  3682840055,
  3913112168,
  2491498743,
  4132185628,
  2489919796,
  1091903735,
  1979897079,
  3170134830,
  3567386728,
  3557303409,
  857797738,
  1136121015,
  1342202287,
  507115054,
  2535736646,
  337727348,
  3213592640,
  1301675037,
  2528481711,
  1895095763,
  1721773893,
  3216771564,
  62756741,
  2142006736,
  835421444,
  2531993523,
  1442658625,
  3659876326,
  2882144922,
  676362277,
  1392781812,
  170690266,
  3921047035,
  1759253602,
  3611846912,
  1745797284,
  664899054,
  1329594018,
  3901205900,
  3045908486,
  2062866102,
  2865634940,
  3543621612,
  3464012697,
  1080764994,
  553557557,
  3656615353,
  3996768171,
  991055499,
  499776247,
  1265440854,
  648242737,
  3940784050,
  980351604,
  3713745714,
  1749149687,
  3396870395,
  4211799374,
  3640570775,
  1161844396,
  3125318951,
  1431517754,
  545492359,
  4268468663,
  3499529547,
  1437099964,
  2702547544,
  3433638243,
  2581715763,
  2787789398,
  1060185593,
  1593081372,
  2418618748,
  4260947970,
  69676912,
  2159744348,
  86519011,
  2512459080,
  3838209314,
  1220612927,
  3339683548,
  133810670,
  1090789135,
  1078426020,
  1569222167,
  845107691,
  3583754449,
  4072456591,
  1091646820,
  628848692,
  1613405280,
  3757631651,
  526609435,
  236106946,
  48312990,
  2942717905,
  3402727701,
  1797494240,
  859738849,
  992217954,
  4005476642,
  2243076622,
  3870952857,
  3732016268,
  765654824,
  3490871365,
  2511836413,
  1685915746,
  3888969200,
  1414112111,
  2273134842,
  3281911079,
  4080962846,
  172450625,
  2569994100,
  980381355,
  4109958455,
  2819808352,
  2716589560,
  2568741196,
  3681446669,
  3329971472,
  1835478071,
  660984891,
  3704678404,
  4045999559,
  3422617507,
  3040415634,
  1762651403,
  1719377915,
  3470491036,
  2693910283,
  3642056355,
  3138596744,
  1364962596,
  2073328063,
  1983633131,
  926494387,
  3423689081,
  2150032023,
  4096667949,
  1749200295,
  3328846651,
  309677260,
  2016342300,
  1779581495,
  3079819751,
  111262694,
  1274766160,
  443224088,
  298511866,
  1025883608,
  3806446537,
  1145181785,
  168956806,
  3641502830,
  3584813610,
  1689216846,
  3666258015,
  3200248200,
  1692713982,
  2646376535,
  4042768518,
  1618508792,
  1610833997,
  3523052358,
  4130873264,
  2001055236,
  3610705100,
  2202168115,
  4028541809,
  2961195399,
  1006657119,
  2006996926,
  3186142756,
  1430667929,
  3210227297,
  1314452623,
  4074634658,
  4101304120,
  2273951170,
  1399257539,
  3367210612,
  3027628629,
  1190975929,
  2062231137,
  2333990788,
  2221543033,
  2438960610,
  1181637006,
  548689776,
  2362791313,
  3372408396,
  3104550113,
  3145860560,
  296247880,
  1970579870,
  3078560182,
  3769228297,
  1714227617,
  3291629107,
  3898220290,
  166772364,
  1251581989,
  493813264,
  448347421,
  195405023,
  2709975567,
  677966185,
  3703036547,
  1463355134,
  2715995803,
  1338867538,
  1343315457,
  2802222074,
  2684532164,
  233230375,
  2599980071,
  2000651841,
  3277868038,
  1638401717,
  4028070440,
  3237316320,
  6314154,
  819756386,
  300326615,
  590932579,
  1405279636,
  3267499572,
  3150704214,
  2428286686,
  3959192993,
  3461946742,
  1862657033,
  1266418056,
  963775037,
  2089974820,
  2263052895,
  1917689273,
  448879540,
  3550394620,
  3981727096,
  150775221,
  3627908307,
  1303187396,
  508620638,
  2975983352,
  2726630617,
  1817252668,
  1876281319,
  1457606340,
  908771278,
  3720792119,
  3617206836,
  2455994898,
  1729034894,
  1080033504,
  976866871,
  3556439503,
  2881648439,
  1522871579,
  1555064734,
  1336096578,
  3548522304,
  2579274686,
  3574697629,
  3205460757,
  3593280638,
  3338716283,
  3079412587,
  564236357,
  2993598910,
  1781952180,
  1464380207,
  3163844217,
  3332601554,
  1699332808,
  1393555694,
  1183702653,
  3581086237,
  1288719814,
  691649499,
  2847557200,
  2895455976,
  3193889540,
  2717570544,
  1781354906,
  1676643554,
  2592534050,
  3230253752,
  1126444790,
  2770207658,
  2633158820,
  2210423226,
  2615765581,
  2414155088,
  3127139286,
  673620729,
  2805611233,
  1269405062,
  4015350505,
  3341807571,
  4149409754,
  1057255273,
  2012875353,
  2162469141,
  2276492801,
  2601117357,
  993977747,
  3918593370,
  2654263191,
  753973209,
  36408145,
  2530585658,
  25011837,
  3520020182,
  2088578344,
  530523599,
  2918365339,
  1524020338,
  1518925132,
  3760827505,
  3759777254,
  1202760957,
  3985898139,
  3906192525,
  674977740,
  4174734889,
  2031300136,
  2019492241,
  3983892565,
  4153806404,
  3822280332,
  352677332,
  2297720250,
  60907813,
  90501309,
  3286998549,
  1016092578,
  2535922412,
  2839152426,
  457141659,
  509813237,
  4120667899,
  652014361,
  1966332200,
  2975202805,
  55981186,
  2327461051,
  676427537,
  3255491064,
  2882294119,
  3433927263,
  1307055953,
  942726286,
  933058658,
  2468411793,
  3933900994,
  4215176142,
  1361170020,
  2001714738,
  2830558078,
  3274259782,
  1222529897,
  1679025792,
  2729314320,
  3714953764,
  1770335741,
  151462246,
  3013232138,
  1682292957,
  1483529935,
  471910574,
  1539241949,
  458788160,
  3436315007,
  1807016891,
  3718408830,
  978976581,
  1043663428,
  3165965781,
  1927990952,
  4200891579,
  2372276910,
  3208408903,
  3533431907,
  1412390302,
  2931980059,
  4132332400,
  1947078029,
  3881505623,
  4168226417,
  2941484381,
  1077988104,
  1320477388,
  886195818,
  18198404,
  3786409e3,
  2509781533,
  112762804,
  3463356488,
  1866414978,
  891333506,
  18488651,
  661792760,
  1628790961,
  3885187036,
  3141171499,
  876946877,
  2693282273,
  1372485963,
  791857591,
  2686433993,
  3759982718,
  3167212022,
  3472953795,
  2716379847,
  445679433,
  3561995674,
  3504004811,
  3574258232,
  54117162,
  3331405415,
  2381918588,
  3769707343,
  4154350007,
  1140177722,
  4074052095,
  668550556,
  3214352940,
  367459370,
  261225585,
  2610173221,
  4209349473,
  3468074219,
  3265815641,
  314222801,
  3066103646,
  3808782860,
  282218597,
  3406013506,
  3773591054,
  379116347,
  1285071038,
  846784868,
  2669647154,
  3771962079,
  3550491691,
  2305946142,
  453669953,
  1268987020,
  3317592352,
  3279303384,
  3744833421,
  2610507566,
  3859509063,
  266596637,
  3847019092,
  517658769,
  3462560207,
  3443424879,
  370717030,
  4247526661,
  2224018117,
  4143653529,
  4112773975,
  2788324899,
  2477274417,
  1456262402,
  2901442914,
  1517677493,
  1846949527,
  2295493580,
  3734397586,
  2176403920,
  1280348187,
  1908823572,
  3871786941,
  846861322,
  1172426758,
  3287448474,
  3383383037,
  1655181056,
  3139813346,
  901632758,
  1897031941,
  2986607138,
  3066810236,
  3447102507,
  1393639104,
  373351379,
  950779232,
  625454576,
  3124240540,
  4148612726,
  2007998917,
  544563296,
  2244738638,
  2330496472,
  2058025392,
  1291430526,
  424198748,
  50039436,
  29584100,
  3605783033,
  2429876329,
  2791104160,
  1057563949,
  3255363231,
  3075367218,
  3463963227,
  1469046755,
  985887462
];
var C_ORIG = [
  1332899944,
  1700884034,
  1701343084,
  1684370003,
  1668446532,
  1869963892
];
function _encipher(lr, off, P, S) {
  var n, l = lr[off], r = lr[off + 1];
  l ^= P[0];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[1];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[2];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[3];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[4];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[5];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[6];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[7];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[8];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[9];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[10];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[11];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[12];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[13];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[14];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[15];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[16];
  lr[off] = r ^ P[BLOWFISH_NUM_ROUNDS + 1];
  lr[off + 1] = l;
  return lr;
}
function _streamtoword(data, offp) {
  for (var i = 0, word = 0; i < 4; ++i)
    word = word << 8 | data[offp] & 255, offp = (offp + 1) % data.length;
  return { key: word, offp };
}
function _key(key, P, S) {
  var offset = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
  for (var i = 0; i < plen; i++)
    sw = _streamtoword(key, offset), offset = sw.offp, P[i] = P[i] ^ sw.key;
  for (i = 0; i < plen; i += 2)
    lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
  for (i = 0; i < slen; i += 2)
    lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
}
function _ekskey(data, key, P, S) {
  var offp = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
  for (var i = 0; i < plen; i++)
    sw = _streamtoword(key, offp), offp = sw.offp, P[i] = P[i] ^ sw.key;
  offp = 0;
  for (i = 0; i < plen; i += 2)
    sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
  for (i = 0; i < slen; i += 2)
    sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
}
function _crypt(b, salt, rounds, callback, progressCallback) {
  var cdata = C_ORIG.slice(), clen = cdata.length, err;
  if (rounds < 4 || rounds > 31) {
    err = Error("Illegal number of rounds (4-31): " + rounds);
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  if (salt.length !== BCRYPT_SALT_LEN) {
    err = Error(
      "Illegal salt length: " + salt.length + " != " + BCRYPT_SALT_LEN
    );
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  rounds = 1 << rounds >>> 0;
  var P, S, i = 0, j;
  if (typeof Int32Array === "function") {
    P = new Int32Array(P_ORIG);
    S = new Int32Array(S_ORIG);
  } else {
    P = P_ORIG.slice();
    S = S_ORIG.slice();
  }
  _ekskey(salt, b, P, S);
  function next() {
    if (progressCallback) progressCallback(i / rounds);
    if (i < rounds) {
      var start = Date.now();
      for (; i < rounds; ) {
        i = i + 1;
        _key(b, P, S);
        _key(salt, P, S);
        if (Date.now() - start > MAX_EXECUTION_TIME) break;
      }
    } else {
      for (i = 0; i < 64; i++)
        for (j = 0; j < clen >> 1; j++) _encipher(cdata, j << 1, P, S);
      var ret = [];
      for (i = 0; i < clen; i++)
        ret.push((cdata[i] >> 24 & 255) >>> 0), ret.push((cdata[i] >> 16 & 255) >>> 0), ret.push((cdata[i] >> 8 & 255) >>> 0), ret.push((cdata[i] & 255) >>> 0);
      if (callback) {
        callback(null, ret);
        return;
      } else return ret;
    }
    if (callback) nextTick(next);
  }
  if (typeof callback !== "undefined") {
    next();
  } else {
    var res;
    while (true) if (typeof (res = next()) !== "undefined") return res || [];
  }
}
function _hash(password, salt, callback, progressCallback) {
  var err;
  if (typeof password !== "string" || typeof salt !== "string") {
    err = Error("Invalid string / salt: Not a string");
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  var minor, offset;
  if (salt.charAt(0) !== "$" || salt.charAt(1) !== "2") {
    err = Error("Invalid salt version: " + salt.substring(0, 2));
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  if (salt.charAt(2) === "$") minor = String.fromCharCode(0), offset = 3;
  else {
    minor = salt.charAt(2);
    if (minor !== "a" && minor !== "b" && minor !== "y" || salt.charAt(3) !== "$") {
      err = Error("Invalid salt revision: " + salt.substring(2, 4));
      if (callback) {
        nextTick(callback.bind(this, err));
        return;
      } else throw err;
    }
    offset = 4;
  }
  if (salt.charAt(offset + 2) > "$") {
    err = Error("Missing salt rounds");
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  var r1 = parseInt(salt.substring(offset, offset + 1), 10) * 10, r2 = parseInt(salt.substring(offset + 1, offset + 2), 10), rounds = r1 + r2, real_salt = salt.substring(offset + 3, offset + 25);
  password += minor >= "a" ? "\0" : "";
  var passwordb = utf8Array(password), saltb = base64_decode(real_salt, BCRYPT_SALT_LEN);
  function finish(bytes) {
    var res = [];
    res.push("$2");
    if (minor >= "a") res.push(minor);
    res.push("$");
    if (rounds < 10) res.push("0");
    res.push(rounds.toString());
    res.push("$");
    res.push(base64_encode(saltb, saltb.length));
    res.push(base64_encode(bytes, C_ORIG.length * 4 - 1));
    return res.join("");
  }
  if (typeof callback == "undefined")
    return finish(_crypt(passwordb, saltb, rounds));
  else {
    _crypt(
      passwordb,
      saltb,
      rounds,
      function(err2, bytes) {
        if (err2) callback(err2, null);
        else callback(null, finish(bytes));
      },
      progressCallback
    );
  }
}
function encodeBase64(bytes, length) {
  return base64_encode(bytes, length);
}
function decodeBase64(string, length) {
  return base64_decode(string, length);
}
const bcrypt = {
  setRandomFallback,
  genSaltSync,
  genSalt,
  hashSync,
  hash,
  compareSync,
  compare,
  getRounds,
  getSalt,
  truncates,
  encodeBase64,
  decodeBase64
};
const SALT_ROUNDS = 10;
function setupAuthHandlers() {
  ipcMain.handle("auth:register", async (_, { username, password, hint }) => {
    try {
      const stmt = db.prepare("INSERT INTO users (username, password_hash, hint) VALUES (?, ?, ?)");
      const hash2 = await bcrypt.hash(password, SALT_ROUNDS);
      const info = stmt.run(username, hash2, hint);
      return { success: true, userId: info.lastInsertRowid };
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
        return { success: false, error: "Username already exists" };
      }
      console.error("Registration error:", error);
      return { success: false, error: "Registration failed" };
    }
  });
  ipcMain.handle("auth:login", async (_, { username, password }) => {
    try {
      const stmt = db.prepare("SELECT * FROM users WHERE username = ?");
      const user = stmt.get(username);
      if (!user) {
        return { success: false, error: "User not found" };
      }
      const match = await bcrypt.compare(password, user.password_hash);
      if (match) {
        return { success: true, user: { id: user.id, username: user.username } };
      } else {
        return { success: false, error: "Invalid credentials" };
      }
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, error: "Login failed" };
    }
  });
  ipcMain.handle("auth:get-hint", async (_, username) => {
    try {
      const stmt = db.prepare("SELECT hint FROM users WHERE username = ?");
      const user = stmt.get(username);
      return { success: true, hint: user ? user.hint : null };
    } catch (error) {
      console.error("Get hint error:", error);
      return { success: false, error: "Failed to retrieve hint" };
    }
  });
}
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var utils$2 = { exports: {} };
var windows;
var hasRequiredWindows;
function requireWindows() {
  if (hasRequiredWindows) return windows;
  hasRequiredWindows = 1;
  windows = isexe2;
  isexe2.sync = sync2;
  var fs$12 = fs;
  function checkPathExt(path, options) {
    var pathext = options.pathExt !== void 0 ? options.pathExt : process.env.PATHEXT;
    if (!pathext) {
      return true;
    }
    pathext = pathext.split(";");
    if (pathext.indexOf("") !== -1) {
      return true;
    }
    for (var i = 0; i < pathext.length; i++) {
      var p = pathext[i].toLowerCase();
      if (p && path.substr(-p.length).toLowerCase() === p) {
        return true;
      }
    }
    return false;
  }
  function checkStat(stat, path, options) {
    if (!stat.isSymbolicLink() && !stat.isFile()) {
      return false;
    }
    return checkPathExt(path, options);
  }
  function isexe2(path, options, cb) {
    fs$12.stat(path, function(er, stat) {
      cb(er, er ? false : checkStat(stat, path, options));
    });
  }
  function sync2(path, options) {
    return checkStat(fs$12.statSync(path), path, options);
  }
  return windows;
}
var mode;
var hasRequiredMode;
function requireMode() {
  if (hasRequiredMode) return mode;
  hasRequiredMode = 1;
  mode = isexe2;
  isexe2.sync = sync2;
  var fs$12 = fs;
  function isexe2(path, options, cb) {
    fs$12.stat(path, function(er, stat) {
      cb(er, er ? false : checkStat(stat, options));
    });
  }
  function sync2(path, options) {
    return checkStat(fs$12.statSync(path), options);
  }
  function checkStat(stat, options) {
    return stat.isFile() && checkMode(stat, options);
  }
  function checkMode(stat, options) {
    var mod = stat.mode;
    var uid = stat.uid;
    var gid = stat.gid;
    var myUid = options.uid !== void 0 ? options.uid : process.getuid && process.getuid();
    var myGid = options.gid !== void 0 ? options.gid : process.getgid && process.getgid();
    var u = parseInt("100", 8);
    var g = parseInt("010", 8);
    var o = parseInt("001", 8);
    var ug = u | g;
    var ret = mod & o || mod & g && gid === myGid || mod & u && uid === myUid || mod & ug && myUid === 0;
    return ret;
  }
  return mode;
}
var core;
if (process.platform === "win32" || commonjsGlobal.TESTING_WINDOWS) {
  core = requireWindows();
} else {
  core = requireMode();
}
var isexe_1 = isexe$1;
isexe$1.sync = sync;
function isexe$1(path, options, cb) {
  if (typeof options === "function") {
    cb = options;
    options = {};
  }
  if (!cb) {
    if (typeof Promise !== "function") {
      throw new TypeError("callback not provided");
    }
    return new Promise(function(resolve, reject) {
      isexe$1(path, options || {}, function(er, is) {
        if (er) {
          reject(er);
        } else {
          resolve(is);
        }
      });
    });
  }
  core(path, options || {}, function(er, is) {
    if (er) {
      if (er.code === "EACCES" || options && options.ignoreErrors) {
        er = null;
        is = false;
      }
    }
    cb(er, is);
  });
}
function sync(path, options) {
  try {
    return core.sync(path, options || {});
  } catch (er) {
    if (options && options.ignoreErrors || er.code === "EACCES") {
      return false;
    } else {
      throw er;
    }
  }
}
var which_1 = which$1;
which$1.sync = whichSync;
var isWindows$1 = process.platform === "win32" || process.env.OSTYPE === "cygwin" || process.env.OSTYPE === "msys";
var path$2 = path$3;
var COLON = isWindows$1 ? ";" : ":";
var isexe = isexe_1;
function getNotFoundError(cmd) {
  var er = new Error("not found: " + cmd);
  er.code = "ENOENT";
  return er;
}
function getPathInfo(cmd, opt) {
  var colon = opt.colon || COLON;
  var pathEnv = opt.path || process.env.PATH || "";
  var pathExt = [""];
  pathEnv = pathEnv.split(colon);
  var pathExtExe = "";
  if (isWindows$1) {
    pathEnv.unshift(process.cwd());
    pathExtExe = opt.pathExt || process.env.PATHEXT || ".EXE;.CMD;.BAT;.COM";
    pathExt = pathExtExe.split(colon);
    if (cmd.indexOf(".") !== -1 && pathExt[0] !== "")
      pathExt.unshift("");
  }
  if (cmd.match(/\//) || isWindows$1 && cmd.match(/\\/))
    pathEnv = [""];
  return {
    env: pathEnv,
    ext: pathExt,
    extExe: pathExtExe
  };
}
function which$1(cmd, opt, cb) {
  if (typeof opt === "function") {
    cb = opt;
    opt = {};
  }
  var info = getPathInfo(cmd, opt);
  var pathEnv = info.env;
  var pathExt = info.ext;
  var pathExtExe = info.extExe;
  var found = [];
  (function F(i, l) {
    if (i === l) {
      if (opt.all && found.length)
        return cb(null, found);
      else
        return cb(getNotFoundError(cmd));
    }
    var pathPart = pathEnv[i];
    if (pathPart.charAt(0) === '"' && pathPart.slice(-1) === '"')
      pathPart = pathPart.slice(1, -1);
    var p = path$2.join(pathPart, cmd);
    if (!pathPart && /^\.[\\\/]/.test(cmd)) {
      p = cmd.slice(0, 2) + p;
    }
    (function E(ii, ll) {
      if (ii === ll) return F(i + 1, l);
      var ext = pathExt[ii];
      isexe(p + ext, { pathExt: pathExtExe }, function(er, is) {
        if (!er && is) {
          if (opt.all)
            found.push(p + ext);
          else
            return cb(null, p + ext);
        }
        return E(ii + 1, ll);
      });
    })(0, pathExt.length);
  })(0, pathEnv.length);
}
function whichSync(cmd, opt) {
  opt = opt || {};
  var info = getPathInfo(cmd, opt);
  var pathEnv = info.env;
  var pathExt = info.ext;
  var pathExtExe = info.extExe;
  var found = [];
  for (var i = 0, l = pathEnv.length; i < l; i++) {
    var pathPart = pathEnv[i];
    if (pathPart.charAt(0) === '"' && pathPart.slice(-1) === '"')
      pathPart = pathPart.slice(1, -1);
    var p = path$2.join(pathPart, cmd);
    if (!pathPart && /^\.[\\\/]/.test(cmd)) {
      p = cmd.slice(0, 2) + p;
    }
    for (var j = 0, ll = pathExt.length; j < ll; j++) {
      var cur = p + pathExt[j];
      var is;
      try {
        is = isexe.sync(cur, { pathExt: pathExtExe });
        if (is) {
          if (opt.all)
            found.push(cur);
          else
            return cur;
        }
      } catch (ex) {
      }
    }
  }
  if (opt.all && found.length)
    return found;
  if (opt.nothrow)
    return null;
  throw getNotFoundError(cmd);
}
require$$0$1.exec;
var isWindows = require$$1.platform().match(/win(32|64)/);
var which = which_1;
var nlRegexp = /\r\n|\r|\n/g;
var streamRegexp = /^\[?(.*?)\]?$/;
var filterEscapeRegexp = /[,]/;
var whichCache = {};
function parseProgressLine(line) {
  var progress = {};
  line = line.replace(/=\s+/g, "=").trim();
  var progressParts = line.split(" ");
  for (var i = 0; i < progressParts.length; i++) {
    var progressSplit = progressParts[i].split("=", 2);
    var key = progressSplit[0];
    var value = progressSplit[1];
    if (typeof value === "undefined")
      return null;
    progress[key] = value;
  }
  return progress;
}
var utils$1 = utils$2.exports = {
  isWindows,
  streamRegexp,
  /**
   * Copy an object keys into another one
   *
   * @param {Object} source source object
   * @param {Object} dest destination object
   * @private
   */
  copy: function(source, dest) {
    Object.keys(source).forEach(function(key) {
      dest[key] = source[key];
    });
  },
  /**
   * Create an argument list
   *
   * Returns a function that adds new arguments to the list.
   * It also has the following methods:
   * - clear() empties the argument list
   * - get() returns the argument list
   * - find(arg, count) finds 'arg' in the list and return the following 'count' items, or undefined if not found
   * - remove(arg, count) remove 'arg' in the list as well as the following 'count' items
   *
   * @private
   */
  args: function() {
    var list = [];
    var argfunc = function() {
      if (arguments.length === 1 && Array.isArray(arguments[0])) {
        list = list.concat(arguments[0]);
      } else {
        list = list.concat([].slice.call(arguments));
      }
    };
    argfunc.clear = function() {
      list = [];
    };
    argfunc.get = function() {
      return list;
    };
    argfunc.find = function(arg, count) {
      var index = list.indexOf(arg);
      if (index !== -1) {
        return list.slice(index + 1, index + 1 + (count || 0));
      }
    };
    argfunc.remove = function(arg, count) {
      var index = list.indexOf(arg);
      if (index !== -1) {
        list.splice(index, (count || 0) + 1);
      }
    };
    argfunc.clone = function() {
      var cloned = utils$1.args();
      cloned(list);
      return cloned;
    };
    return argfunc;
  },
  /**
   * Generate filter strings
   *
   * @param {String[]|Object[]} filters filter specifications. When using objects,
   *   each must have the following properties:
   * @param {String} filters.filter filter name
   * @param {String|Array} [filters.inputs] (array of) input stream specifier(s) for the filter,
   *   defaults to ffmpeg automatically choosing the first unused matching streams
   * @param {String|Array} [filters.outputs] (array of) output stream specifier(s) for the filter,
   *   defaults to ffmpeg automatically assigning the output to the output file
   * @param {Object|String|Array} [filters.options] filter options, can be omitted to not set any options
   * @return String[]
   * @private
   */
  makeFilterStrings: function(filters) {
    return filters.map(function(filterSpec) {
      if (typeof filterSpec === "string") {
        return filterSpec;
      }
      var filterString = "";
      if (Array.isArray(filterSpec.inputs)) {
        filterString += filterSpec.inputs.map(function(streamSpec) {
          return streamSpec.replace(streamRegexp, "[$1]");
        }).join("");
      } else if (typeof filterSpec.inputs === "string") {
        filterString += filterSpec.inputs.replace(streamRegexp, "[$1]");
      }
      filterString += filterSpec.filter;
      if (filterSpec.options) {
        if (typeof filterSpec.options === "string" || typeof filterSpec.options === "number") {
          filterString += "=" + filterSpec.options;
        } else if (Array.isArray(filterSpec.options)) {
          filterString += "=" + filterSpec.options.map(function(option) {
            if (typeof option === "string" && option.match(filterEscapeRegexp)) {
              return "'" + option + "'";
            } else {
              return option;
            }
          }).join(":");
        } else if (Object.keys(filterSpec.options).length) {
          filterString += "=" + Object.keys(filterSpec.options).map(function(option) {
            var value = filterSpec.options[option];
            if (typeof value === "string" && value.match(filterEscapeRegexp)) {
              value = "'" + value + "'";
            }
            return option + "=" + value;
          }).join(":");
        }
      }
      if (Array.isArray(filterSpec.outputs)) {
        filterString += filterSpec.outputs.map(function(streamSpec) {
          return streamSpec.replace(streamRegexp, "[$1]");
        }).join("");
      } else if (typeof filterSpec.outputs === "string") {
        filterString += filterSpec.outputs.replace(streamRegexp, "[$1]");
      }
      return filterString;
    });
  },
  /**
   * Search for an executable
   *
   * Uses 'which' or 'where' depending on platform
   *
   * @param {String} name executable name
   * @param {Function} callback callback with signature (err, path)
   * @private
   */
  which: function(name2, callback) {
    if (name2 in whichCache) {
      return callback(null, whichCache[name2]);
    }
    which(name2, function(err, result) {
      if (err) {
        return callback(null, whichCache[name2] = "");
      }
      callback(null, whichCache[name2] = result);
    });
  },
  /**
   * Convert a [[hh:]mm:]ss[.xxx] timemark into seconds
   *
   * @param {String} timemark timemark string
   * @return Number
   * @private
   */
  timemarkToSeconds: function(timemark) {
    if (typeof timemark === "number") {
      return timemark;
    }
    if (timemark.indexOf(":") === -1 && timemark.indexOf(".") >= 0) {
      return Number(timemark);
    }
    var parts = timemark.split(":");
    var secs = Number(parts.pop());
    if (parts.length) {
      secs += Number(parts.pop()) * 60;
    }
    if (parts.length) {
      secs += Number(parts.pop()) * 3600;
    }
    return secs;
  },
  /**
   * Extract codec data from ffmpeg stderr and emit 'codecData' event if appropriate
   * Call it with an initially empty codec object once with each line of stderr output until it returns true
   *
   * @param {FfmpegCommand} command event emitter
   * @param {String} stderrLine ffmpeg stderr output line
   * @param {Object} codecObject object used to accumulate codec data between calls
   * @return {Boolean} true if codec data is complete (and event was emitted), false otherwise
   * @private
   */
  extractCodecData: function(command, stderrLine, codecsObject) {
    var inputPattern = /Input #[0-9]+, ([^ ]+),/;
    var durPattern = /Duration\: ([^,]+)/;
    var audioPattern = /Audio\: (.*)/;
    var videoPattern = /Video\: (.*)/;
    if (!("inputStack" in codecsObject)) {
      codecsObject.inputStack = [];
      codecsObject.inputIndex = -1;
      codecsObject.inInput = false;
    }
    var inputStack = codecsObject.inputStack;
    var inputIndex = codecsObject.inputIndex;
    var inInput = codecsObject.inInput;
    var format, dur, audio2, video2;
    if (format = stderrLine.match(inputPattern)) {
      inInput = codecsObject.inInput = true;
      inputIndex = codecsObject.inputIndex = codecsObject.inputIndex + 1;
      inputStack[inputIndex] = { format: format[1], audio: "", video: "", duration: "" };
    } else if (inInput && (dur = stderrLine.match(durPattern))) {
      inputStack[inputIndex].duration = dur[1];
    } else if (inInput && (audio2 = stderrLine.match(audioPattern))) {
      audio2 = audio2[1].split(", ");
      inputStack[inputIndex].audio = audio2[0];
      inputStack[inputIndex].audio_details = audio2;
    } else if (inInput && (video2 = stderrLine.match(videoPattern))) {
      video2 = video2[1].split(", ");
      inputStack[inputIndex].video = video2[0];
      inputStack[inputIndex].video_details = video2;
    } else if (/Output #\d+/.test(stderrLine)) {
      inInput = codecsObject.inInput = false;
    } else if (/Stream mapping:|Press (\[q\]|ctrl-c) to stop/.test(stderrLine)) {
      command.emit.apply(command, ["codecData"].concat(inputStack));
      return true;
    }
    return false;
  },
  /**
   * Extract progress data from ffmpeg stderr and emit 'progress' event if appropriate
   *
   * @param {FfmpegCommand} command event emitter
   * @param {String} stderrLine ffmpeg stderr data
   * @private
   */
  extractProgress: function(command, stderrLine) {
    var progress = parseProgressLine(stderrLine);
    if (progress) {
      var ret = {
        frames: parseInt(progress.frame, 10),
        currentFps: parseInt(progress.fps, 10),
        currentKbps: progress.bitrate ? parseFloat(progress.bitrate.replace("kbits/s", "")) : 0,
        targetSize: parseInt(progress.size || progress.Lsize, 10),
        timemark: progress.time
      };
      if (command._ffprobeData && command._ffprobeData.format && command._ffprobeData.format.duration) {
        var duration = Number(command._ffprobeData.format.duration);
        if (!isNaN(duration))
          ret.percent = utils$1.timemarkToSeconds(ret.timemark) / duration * 100;
      }
      command.emit("progress", ret);
    }
  },
  /**
   * Extract error message(s) from ffmpeg stderr
   *
   * @param {String} stderr ffmpeg stderr data
   * @return {String}
   * @private
   */
  extractError: function(stderr) {
    return stderr.split(nlRegexp).reduce(function(messages, message) {
      if (message.charAt(0) === " " || message.charAt(0) === "[") {
        return [];
      } else {
        messages.push(message);
        return messages;
      }
    }, []).join("\n");
  },
  /**
   * Creates a line ring buffer object with the following methods:
   * - append(str) : appends a string or buffer
   * - get() : returns the whole string
   * - close() : prevents further append() calls and does a last call to callbacks
   * - callback(cb) : calls cb for each line (incl. those already in the ring)
   *
   * @param {Number} maxLines maximum number of lines to store (<= 0 for unlimited)
   */
  linesRing: function(maxLines) {
    var cbs = [];
    var lines = [];
    var current = null;
    var closed = false;
    var max = maxLines - 1;
    function emit(line) {
      cbs.forEach(function(cb) {
        cb(line);
      });
    }
    return {
      callback: function(cb) {
        lines.forEach(function(l) {
          cb(l);
        });
        cbs.push(cb);
      },
      append: function(str) {
        if (closed) return;
        if (str instanceof Buffer) str = "" + str;
        if (!str || str.length === 0) return;
        var newLines = str.split(nlRegexp);
        if (newLines.length === 1) {
          if (current !== null) {
            current = current + newLines.shift();
          } else {
            current = newLines.shift();
          }
        } else {
          if (current !== null) {
            current = current + newLines.shift();
            emit(current);
            lines.push(current);
          }
          current = newLines.pop();
          newLines.forEach(function(l) {
            emit(l);
            lines.push(l);
          });
          if (max > -1 && lines.length > max) {
            lines.splice(0, lines.length - max);
          }
        }
      },
      get: function() {
        if (current !== null) {
          return lines.concat([current]).join("\n");
        } else {
          return lines.join("\n");
        }
      },
      close: function() {
        if (closed) return;
        if (current !== null) {
          emit(current);
          lines.push(current);
          if (max > -1 && lines.length > max) {
            lines.shift();
          }
          current = null;
        }
        closed = true;
      }
    };
  }
};
var utilsExports = utils$2.exports;
var inputs;
var hasRequiredInputs;
function requireInputs() {
  if (hasRequiredInputs) return inputs;
  hasRequiredInputs = 1;
  var utils2 = utilsExports;
  inputs = function(proto) {
    proto.mergeAdd = proto.addInput = proto.input = function(source) {
      var isFile = false;
      var isStream = false;
      if (typeof source !== "string") {
        if (!("readable" in source) || !source.readable) {
          throw new Error("Invalid input");
        }
        var hasInputStream = this._inputs.some(function(input) {
          return input.isStream;
        });
        if (hasInputStream) {
          throw new Error("Only one input stream is supported");
        }
        isStream = true;
        source.pause();
      } else {
        var protocol = source.match(/^([a-z]{2,}):/i);
        isFile = !protocol || protocol[0] === "file";
      }
      this._inputs.push(this._currentInput = {
        source,
        isFile,
        isStream,
        options: utils2.args()
      });
      return this;
    };
    proto.withInputFormat = proto.inputFormat = proto.fromFormat = function(format) {
      if (!this._currentInput) {
        throw new Error("No input specified");
      }
      this._currentInput.options("-f", format);
      return this;
    };
    proto.withInputFps = proto.withInputFPS = proto.withFpsInput = proto.withFPSInput = proto.inputFPS = proto.inputFps = proto.fpsInput = proto.FPSInput = function(fps) {
      if (!this._currentInput) {
        throw new Error("No input specified");
      }
      this._currentInput.options("-r", fps);
      return this;
    };
    proto.nativeFramerate = proto.withNativeFramerate = proto.native = function() {
      if (!this._currentInput) {
        throw new Error("No input specified");
      }
      this._currentInput.options("-re");
      return this;
    };
    proto.setStartTime = proto.seekInput = function(seek) {
      if (!this._currentInput) {
        throw new Error("No input specified");
      }
      this._currentInput.options("-ss", seek);
      return this;
    };
    proto.loop = function(duration) {
      if (!this._currentInput) {
        throw new Error("No input specified");
      }
      this._currentInput.options("-loop", "1");
      if (typeof duration !== "undefined") {
        this.duration(duration);
      }
      return this;
    };
  };
  return inputs;
}
var audio;
var hasRequiredAudio;
function requireAudio() {
  if (hasRequiredAudio) return audio;
  hasRequiredAudio = 1;
  var utils2 = utilsExports;
  audio = function(proto) {
    proto.withNoAudio = proto.noAudio = function() {
      this._currentOutput.audio.clear();
      this._currentOutput.audioFilters.clear();
      this._currentOutput.audio("-an");
      return this;
    };
    proto.withAudioCodec = proto.audioCodec = function(codec) {
      this._currentOutput.audio("-acodec", codec);
      return this;
    };
    proto.withAudioBitrate = proto.audioBitrate = function(bitrate) {
      this._currentOutput.audio("-b:a", ("" + bitrate).replace(/k?$/, "k"));
      return this;
    };
    proto.withAudioChannels = proto.audioChannels = function(channels) {
      this._currentOutput.audio("-ac", channels);
      return this;
    };
    proto.withAudioFrequency = proto.audioFrequency = function(freq) {
      this._currentOutput.audio("-ar", freq);
      return this;
    };
    proto.withAudioQuality = proto.audioQuality = function(quality) {
      this._currentOutput.audio("-aq", quality);
      return this;
    };
    proto.withAudioFilter = proto.withAudioFilters = proto.audioFilter = proto.audioFilters = function(filters) {
      if (arguments.length > 1) {
        filters = [].slice.call(arguments);
      }
      if (!Array.isArray(filters)) {
        filters = [filters];
      }
      this._currentOutput.audioFilters(utils2.makeFilterStrings(filters));
      return this;
    };
  };
  return audio;
}
var video;
var hasRequiredVideo;
function requireVideo() {
  if (hasRequiredVideo) return video;
  hasRequiredVideo = 1;
  var utils2 = utilsExports;
  video = function(proto) {
    proto.withNoVideo = proto.noVideo = function() {
      this._currentOutput.video.clear();
      this._currentOutput.videoFilters.clear();
      this._currentOutput.video("-vn");
      return this;
    };
    proto.withVideoCodec = proto.videoCodec = function(codec) {
      this._currentOutput.video("-vcodec", codec);
      return this;
    };
    proto.withVideoBitrate = proto.videoBitrate = function(bitrate, constant) {
      bitrate = ("" + bitrate).replace(/k?$/, "k");
      this._currentOutput.video("-b:v", bitrate);
      if (constant) {
        this._currentOutput.video(
          "-maxrate",
          bitrate,
          "-minrate",
          bitrate,
          "-bufsize",
          "3M"
        );
      }
      return this;
    };
    proto.withVideoFilter = proto.withVideoFilters = proto.videoFilter = proto.videoFilters = function(filters) {
      if (arguments.length > 1) {
        filters = [].slice.call(arguments);
      }
      if (!Array.isArray(filters)) {
        filters = [filters];
      }
      this._currentOutput.videoFilters(utils2.makeFilterStrings(filters));
      return this;
    };
    proto.withOutputFps = proto.withOutputFPS = proto.withFpsOutput = proto.withFPSOutput = proto.withFps = proto.withFPS = proto.outputFPS = proto.outputFps = proto.fpsOutput = proto.FPSOutput = proto.fps = proto.FPS = function(fps) {
      this._currentOutput.video("-r", fps);
      return this;
    };
    proto.takeFrames = proto.withFrames = proto.frames = function(frames) {
      this._currentOutput.video("-vframes", frames);
      return this;
    };
  };
  return video;
}
var videosize;
var hasRequiredVideosize;
function requireVideosize() {
  if (hasRequiredVideosize) return videosize;
  hasRequiredVideosize = 1;
  function getScalePadFilters(width, height, aspect, color) {
    return [
      /*
        In both cases, we first have to scale the input to match the requested size.
        When using computed width/height, we truncate them to multiples of 2
       */
      {
        filter: "scale",
        options: {
          w: "if(gt(a," + aspect + ")," + width + ",trunc(" + height + "*a/2)*2)",
          h: "if(lt(a," + aspect + ")," + height + ",trunc(" + width + "/a/2)*2)"
        }
      },
      /*
        Then we pad the scaled input to match the target size
        (here iw and ih refer to the padding input, i.e the scaled output)
       */
      {
        filter: "pad",
        options: {
          w: width,
          h: height,
          x: "if(gt(a," + aspect + "),0,(" + width + "-iw)/2)",
          y: "if(lt(a," + aspect + "),0,(" + height + "-ih)/2)",
          color
        }
      }
    ];
  }
  function createSizeFilters(output2, key, value) {
    var data = output2.sizeData = output2.sizeData || {};
    data[key] = value;
    if (!("size" in data)) {
      return [];
    }
    var fixedSize = data.size.match(/([0-9]+)x([0-9]+)/);
    var fixedWidth = data.size.match(/([0-9]+)x\?/);
    var fixedHeight = data.size.match(/\?x([0-9]+)/);
    var percentRatio = data.size.match(/\b([0-9]{1,3})%/);
    var width, height, aspect;
    if (percentRatio) {
      var ratio = Number(percentRatio[1]) / 100;
      return [{
        filter: "scale",
        options: {
          w: "trunc(iw*" + ratio + "/2)*2",
          h: "trunc(ih*" + ratio + "/2)*2"
        }
      }];
    } else if (fixedSize) {
      width = Math.round(Number(fixedSize[1]) / 2) * 2;
      height = Math.round(Number(fixedSize[2]) / 2) * 2;
      aspect = width / height;
      if (data.pad) {
        return getScalePadFilters(width, height, aspect, data.pad);
      } else {
        return [{ filter: "scale", options: { w: width, h: height } }];
      }
    } else if (fixedWidth || fixedHeight) {
      if ("aspect" in data) {
        width = fixedWidth ? fixedWidth[1] : Math.round(Number(fixedHeight[1]) * data.aspect);
        height = fixedHeight ? fixedHeight[1] : Math.round(Number(fixedWidth[1]) / data.aspect);
        width = Math.round(width / 2) * 2;
        height = Math.round(height / 2) * 2;
        if (data.pad) {
          return getScalePadFilters(width, height, data.aspect, data.pad);
        } else {
          return [{ filter: "scale", options: { w: width, h: height } }];
        }
      } else {
        if (fixedWidth) {
          return [{
            filter: "scale",
            options: {
              w: Math.round(Number(fixedWidth[1]) / 2) * 2,
              h: "trunc(ow/a/2)*2"
            }
          }];
        } else {
          return [{
            filter: "scale",
            options: {
              w: "trunc(oh*a/2)*2",
              h: Math.round(Number(fixedHeight[1]) / 2) * 2
            }
          }];
        }
      }
    } else {
      throw new Error("Invalid size specified: " + data.size);
    }
  }
  videosize = function(proto) {
    proto.keepPixelAspect = // Only for compatibility, this is not about keeping _pixel_ aspect ratio
    proto.keepDisplayAspect = proto.keepDisplayAspectRatio = proto.keepDAR = function() {
      return this.videoFilters([
        {
          filter: "scale",
          options: {
            w: "if(gt(sar,1),iw*sar,iw)",
            h: "if(lt(sar,1),ih/sar,ih)"
          }
        },
        {
          filter: "setsar",
          options: "1"
        }
      ]);
    };
    proto.withSize = proto.setSize = proto.size = function(size) {
      var filters = createSizeFilters(this._currentOutput, "size", size);
      this._currentOutput.sizeFilters.clear();
      this._currentOutput.sizeFilters(filters);
      return this;
    };
    proto.withAspect = proto.withAspectRatio = proto.setAspect = proto.setAspectRatio = proto.aspect = proto.aspectRatio = function(aspect) {
      var a = Number(aspect);
      if (isNaN(a)) {
        var match = aspect.match(/^(\d+):(\d+)$/);
        if (match) {
          a = Number(match[1]) / Number(match[2]);
        } else {
          throw new Error("Invalid aspect ratio: " + aspect);
        }
      }
      var filters = createSizeFilters(this._currentOutput, "aspect", a);
      this._currentOutput.sizeFilters.clear();
      this._currentOutput.sizeFilters(filters);
      return this;
    };
    proto.applyAutopadding = proto.applyAutoPadding = proto.applyAutopad = proto.applyAutoPad = proto.withAutopadding = proto.withAutoPadding = proto.withAutopad = proto.withAutoPad = proto.autoPad = proto.autopad = function(pad, color) {
      if (typeof pad === "string") {
        color = pad;
        pad = true;
      }
      if (typeof pad === "undefined") {
        pad = true;
      }
      var filters = createSizeFilters(this._currentOutput, "pad", pad ? color || "black" : false);
      this._currentOutput.sizeFilters.clear();
      this._currentOutput.sizeFilters(filters);
      return this;
    };
  };
  return videosize;
}
var output;
var hasRequiredOutput;
function requireOutput() {
  if (hasRequiredOutput) return output;
  hasRequiredOutput = 1;
  var utils2 = utilsExports;
  output = function(proto) {
    proto.addOutput = proto.output = function(target, pipeopts) {
      var isFile = false;
      if (!target && this._currentOutput) {
        throw new Error("Invalid output");
      }
      if (target && typeof target !== "string") {
        if (!("writable" in target) || !target.writable) {
          throw new Error("Invalid output");
        }
      } else if (typeof target === "string") {
        var protocol = target.match(/^([a-z]{2,}):/i);
        isFile = !protocol || protocol[0] === "file";
      }
      if (target && !("target" in this._currentOutput)) {
        this._currentOutput.target = target;
        this._currentOutput.isFile = isFile;
        this._currentOutput.pipeopts = pipeopts || {};
      } else {
        if (target && typeof target !== "string") {
          var hasOutputStream = this._outputs.some(function(output2) {
            return typeof output2.target !== "string";
          });
          if (hasOutputStream) {
            throw new Error("Only one output stream is supported");
          }
        }
        this._outputs.push(this._currentOutput = {
          target,
          isFile,
          flags: {},
          pipeopts: pipeopts || {}
        });
        var self2 = this;
        ["audio", "audioFilters", "video", "videoFilters", "sizeFilters", "options"].forEach(function(key) {
          self2._currentOutput[key] = utils2.args();
        });
        if (!target) {
          delete this._currentOutput.target;
        }
      }
      return this;
    };
    proto.seekOutput = proto.seek = function(seek) {
      this._currentOutput.options("-ss", seek);
      return this;
    };
    proto.withDuration = proto.setDuration = proto.duration = function(duration) {
      this._currentOutput.options("-t", duration);
      return this;
    };
    proto.toFormat = proto.withOutputFormat = proto.outputFormat = proto.format = function(format) {
      this._currentOutput.options("-f", format);
      return this;
    };
    proto.map = function(spec) {
      this._currentOutput.options("-map", spec.replace(utils2.streamRegexp, "[$1]"));
      return this;
    };
    proto.updateFlvMetadata = proto.flvmeta = function() {
      this._currentOutput.flags.flvmeta = true;
      return this;
    };
  };
  return output;
}
var custom;
var hasRequiredCustom;
function requireCustom() {
  if (hasRequiredCustom) return custom;
  hasRequiredCustom = 1;
  var utils2 = utilsExports;
  custom = function(proto) {
    proto.addInputOption = proto.addInputOptions = proto.withInputOption = proto.withInputOptions = proto.inputOption = proto.inputOptions = function(options) {
      if (!this._currentInput) {
        throw new Error("No input specified");
      }
      var doSplit = true;
      if (arguments.length > 1) {
        options = [].slice.call(arguments);
        doSplit = false;
      }
      if (!Array.isArray(options)) {
        options = [options];
      }
      this._currentInput.options(options.reduce(function(options2, option) {
        var split = String(option).split(" ");
        if (doSplit && split.length === 2) {
          options2.push(split[0], split[1]);
        } else {
          options2.push(option);
        }
        return options2;
      }, []));
      return this;
    };
    proto.addOutputOption = proto.addOutputOptions = proto.addOption = proto.addOptions = proto.withOutputOption = proto.withOutputOptions = proto.withOption = proto.withOptions = proto.outputOption = proto.outputOptions = function(options) {
      var doSplit = true;
      if (arguments.length > 1) {
        options = [].slice.call(arguments);
        doSplit = false;
      }
      if (!Array.isArray(options)) {
        options = [options];
      }
      this._currentOutput.options(options.reduce(function(options2, option) {
        var split = String(option).split(" ");
        if (doSplit && split.length === 2) {
          options2.push(split[0], split[1]);
        } else {
          options2.push(option);
        }
        return options2;
      }, []));
      return this;
    };
    proto.filterGraph = proto.complexFilter = function(spec, map) {
      this._complexFilters.clear();
      if (!Array.isArray(spec)) {
        spec = [spec];
      }
      this._complexFilters("-filter_complex", utils2.makeFilterStrings(spec).join(";"));
      if (Array.isArray(map)) {
        var self2 = this;
        map.forEach(function(streamSpec) {
          self2._complexFilters("-map", streamSpec.replace(utils2.streamRegexp, "[$1]"));
        });
      } else if (typeof map === "string") {
        this._complexFilters("-map", map.replace(utils2.streamRegexp, "[$1]"));
      }
      return this;
    };
  };
  return custom;
}
var misc;
var hasRequiredMisc;
function requireMisc() {
  if (hasRequiredMisc) return misc;
  hasRequiredMisc = 1;
  var path = path$3;
  misc = function(proto) {
    proto.usingPreset = proto.preset = function(preset) {
      if (typeof preset === "function") {
        preset(this);
      } else {
        try {
          var modulePath = path.join(this.options.presets, preset);
          var module = require(modulePath);
          if (typeof module.load === "function") {
            module.load(this);
          } else {
            throw new Error("preset " + modulePath + " has no load() function");
          }
        } catch (err) {
          throw new Error("preset " + modulePath + " could not be loaded: " + err.message);
        }
      }
      return this;
    };
  };
  return misc;
}
var async = { exports: {} };
var hasRequiredAsync;
function requireAsync() {
  if (hasRequiredAsync) return async.exports;
  hasRequiredAsync = 1;
  (function(module) {
    (function() {
      var async2 = {};
      var root, previous_async;
      root = this;
      if (root != null) {
        previous_async = root.async;
      }
      async2.noConflict = function() {
        root.async = previous_async;
        return async2;
      };
      function only_once(fn) {
        var called = false;
        return function() {
          if (called) throw new Error("Callback was already called.");
          called = true;
          fn.apply(root, arguments);
        };
      }
      var _each = function(arr, iterator) {
        if (arr.forEach) {
          return arr.forEach(iterator);
        }
        for (var i = 0; i < arr.length; i += 1) {
          iterator(arr[i], i, arr);
        }
      };
      var _map = function(arr, iterator) {
        if (arr.map) {
          return arr.map(iterator);
        }
        var results = [];
        _each(arr, function(x, i, a) {
          results.push(iterator(x, i, a));
        });
        return results;
      };
      var _reduce = function(arr, iterator, memo) {
        if (arr.reduce) {
          return arr.reduce(iterator, memo);
        }
        _each(arr, function(x, i, a) {
          memo = iterator(memo, x, i, a);
        });
        return memo;
      };
      var _keys = function(obj) {
        if (Object.keys) {
          return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
          if (obj.hasOwnProperty(k)) {
            keys.push(k);
          }
        }
        return keys;
      };
      if (typeof process === "undefined" || !process.nextTick) {
        if (typeof setImmediate === "function") {
          async2.nextTick = function(fn) {
            setImmediate(fn);
          };
          async2.setImmediate = async2.nextTick;
        } else {
          async2.nextTick = function(fn) {
            setTimeout(fn, 0);
          };
          async2.setImmediate = async2.nextTick;
        }
      } else {
        async2.nextTick = process.nextTick;
        if (typeof setImmediate !== "undefined") {
          async2.setImmediate = function(fn) {
            setImmediate(fn);
          };
        } else {
          async2.setImmediate = async2.nextTick;
        }
      }
      async2.each = function(arr, iterator, callback) {
        callback = callback || function() {
        };
        if (!arr.length) {
          return callback();
        }
        var completed = 0;
        _each(arr, function(x) {
          iterator(x, only_once(function(err) {
            if (err) {
              callback(err);
              callback = function() {
              };
            } else {
              completed += 1;
              if (completed >= arr.length) {
                callback(null);
              }
            }
          }));
        });
      };
      async2.forEach = async2.each;
      async2.eachSeries = function(arr, iterator, callback) {
        callback = callback || function() {
        };
        if (!arr.length) {
          return callback();
        }
        var completed = 0;
        var iterate = function() {
          iterator(arr[completed], function(err) {
            if (err) {
              callback(err);
              callback = function() {
              };
            } else {
              completed += 1;
              if (completed >= arr.length) {
                callback(null);
              } else {
                iterate();
              }
            }
          });
        };
        iterate();
      };
      async2.forEachSeries = async2.eachSeries;
      async2.eachLimit = function(arr, limit, iterator, callback) {
        var fn = _eachLimit(limit);
        fn.apply(null, [arr, iterator, callback]);
      };
      async2.forEachLimit = async2.eachLimit;
      var _eachLimit = function(limit) {
        return function(arr, iterator, callback) {
          callback = callback || function() {
          };
          if (!arr.length || limit <= 0) {
            return callback();
          }
          var completed = 0;
          var started = 0;
          var running = 0;
          (function replenish() {
            if (completed >= arr.length) {
              return callback();
            }
            while (running < limit && started < arr.length) {
              started += 1;
              running += 1;
              iterator(arr[started - 1], function(err) {
                if (err) {
                  callback(err);
                  callback = function() {
                  };
                } else {
                  completed += 1;
                  running -= 1;
                  if (completed >= arr.length) {
                    callback();
                  } else {
                    replenish();
                  }
                }
              });
            }
          })();
        };
      };
      var doParallel = function(fn) {
        return function() {
          var args = Array.prototype.slice.call(arguments);
          return fn.apply(null, [async2.each].concat(args));
        };
      };
      var doParallelLimit = function(limit, fn) {
        return function() {
          var args = Array.prototype.slice.call(arguments);
          return fn.apply(null, [_eachLimit(limit)].concat(args));
        };
      };
      var doSeries = function(fn) {
        return function() {
          var args = Array.prototype.slice.call(arguments);
          return fn.apply(null, [async2.eachSeries].concat(args));
        };
      };
      var _asyncMap = function(eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function(x, i) {
          return { index: i, value: x };
        });
        eachfn(arr, function(x, callback2) {
          iterator(x.value, function(err, v) {
            results[x.index] = v;
            callback2(err);
          });
        }, function(err) {
          callback(err, results);
        });
      };
      async2.map = doParallel(_asyncMap);
      async2.mapSeries = doSeries(_asyncMap);
      async2.mapLimit = function(arr, limit, iterator, callback) {
        return _mapLimit(limit)(arr, iterator, callback);
      };
      var _mapLimit = function(limit) {
        return doParallelLimit(limit, _asyncMap);
      };
      async2.reduce = function(arr, memo, iterator, callback) {
        async2.eachSeries(arr, function(x, callback2) {
          iterator(memo, x, function(err, v) {
            memo = v;
            callback2(err);
          });
        }, function(err) {
          callback(err, memo);
        });
      };
      async2.inject = async2.reduce;
      async2.foldl = async2.reduce;
      async2.reduceRight = function(arr, memo, iterator, callback) {
        var reversed = _map(arr, function(x) {
          return x;
        }).reverse();
        async2.reduce(reversed, memo, iterator, callback);
      };
      async2.foldr = async2.reduceRight;
      var _filter = function(eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function(x, i) {
          return { index: i, value: x };
        });
        eachfn(arr, function(x, callback2) {
          iterator(x.value, function(v) {
            if (v) {
              results.push(x);
            }
            callback2();
          });
        }, function(err) {
          callback(_map(results.sort(function(a, b) {
            return a.index - b.index;
          }), function(x) {
            return x.value;
          }));
        });
      };
      async2.filter = doParallel(_filter);
      async2.filterSeries = doSeries(_filter);
      async2.select = async2.filter;
      async2.selectSeries = async2.filterSeries;
      var _reject = function(eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function(x, i) {
          return { index: i, value: x };
        });
        eachfn(arr, function(x, callback2) {
          iterator(x.value, function(v) {
            if (!v) {
              results.push(x);
            }
            callback2();
          });
        }, function(err) {
          callback(_map(results.sort(function(a, b) {
            return a.index - b.index;
          }), function(x) {
            return x.value;
          }));
        });
      };
      async2.reject = doParallel(_reject);
      async2.rejectSeries = doSeries(_reject);
      var _detect = function(eachfn, arr, iterator, main_callback) {
        eachfn(arr, function(x, callback) {
          iterator(x, function(result) {
            if (result) {
              main_callback(x);
              main_callback = function() {
              };
            } else {
              callback();
            }
          });
        }, function(err) {
          main_callback();
        });
      };
      async2.detect = doParallel(_detect);
      async2.detectSeries = doSeries(_detect);
      async2.some = function(arr, iterator, main_callback) {
        async2.each(arr, function(x, callback) {
          iterator(x, function(v) {
            if (v) {
              main_callback(true);
              main_callback = function() {
              };
            }
            callback();
          });
        }, function(err) {
          main_callback(false);
        });
      };
      async2.any = async2.some;
      async2.every = function(arr, iterator, main_callback) {
        async2.each(arr, function(x, callback) {
          iterator(x, function(v) {
            if (!v) {
              main_callback(false);
              main_callback = function() {
              };
            }
            callback();
          });
        }, function(err) {
          main_callback(true);
        });
      };
      async2.all = async2.every;
      async2.sortBy = function(arr, iterator, callback) {
        async2.map(arr, function(x, callback2) {
          iterator(x, function(err, criteria) {
            if (err) {
              callback2(err);
            } else {
              callback2(null, { value: x, criteria });
            }
          });
        }, function(err, results) {
          if (err) {
            return callback(err);
          } else {
            var fn = function(left, right) {
              var a = left.criteria, b = right.criteria;
              return a < b ? -1 : a > b ? 1 : 0;
            };
            callback(null, _map(results.sort(fn), function(x) {
              return x.value;
            }));
          }
        });
      };
      async2.auto = function(tasks, callback) {
        callback = callback || function() {
        };
        var keys = _keys(tasks);
        if (!keys.length) {
          return callback(null);
        }
        var results = {};
        var listeners = [];
        var addListener = function(fn) {
          listeners.unshift(fn);
        };
        var removeListener = function(fn) {
          for (var i = 0; i < listeners.length; i += 1) {
            if (listeners[i] === fn) {
              listeners.splice(i, 1);
              return;
            }
          }
        };
        var taskComplete = function() {
          _each(listeners.slice(0), function(fn) {
            fn();
          });
        };
        addListener(function() {
          if (_keys(results).length === keys.length) {
            callback(null, results);
            callback = function() {
            };
          }
        });
        _each(keys, function(k) {
          var task = tasks[k] instanceof Function ? [tasks[k]] : tasks[k];
          var taskCallback = function(err) {
            var args = Array.prototype.slice.call(arguments, 1);
            if (args.length <= 1) {
              args = args[0];
            }
            if (err) {
              var safeResults = {};
              _each(_keys(results), function(rkey) {
                safeResults[rkey] = results[rkey];
              });
              safeResults[k] = args;
              callback(err, safeResults);
              callback = function() {
              };
            } else {
              results[k] = args;
              async2.setImmediate(taskComplete);
            }
          };
          var requires = task.slice(0, Math.abs(task.length - 1)) || [];
          var ready = function() {
            return _reduce(requires, function(a, x) {
              return a && results.hasOwnProperty(x);
            }, true) && !results.hasOwnProperty(k);
          };
          if (ready()) {
            task[task.length - 1](taskCallback, results);
          } else {
            var listener = function() {
              if (ready()) {
                removeListener(listener);
                task[task.length - 1](taskCallback, results);
              }
            };
            addListener(listener);
          }
        });
      };
      async2.waterfall = function(tasks, callback) {
        callback = callback || function() {
        };
        if (tasks.constructor !== Array) {
          var err = new Error("First argument to waterfall must be an array of functions");
          return callback(err);
        }
        if (!tasks.length) {
          return callback();
        }
        var wrapIterator = function(iterator) {
          return function(err2) {
            if (err2) {
              callback.apply(null, arguments);
              callback = function() {
              };
            } else {
              var args = Array.prototype.slice.call(arguments, 1);
              var next = iterator.next();
              if (next) {
                args.push(wrapIterator(next));
              } else {
                args.push(callback);
              }
              async2.setImmediate(function() {
                iterator.apply(null, args);
              });
            }
          };
        };
        wrapIterator(async2.iterator(tasks))();
      };
      var _parallel = function(eachfn, tasks, callback) {
        callback = callback || function() {
        };
        if (tasks.constructor === Array) {
          eachfn.map(tasks, function(fn, callback2) {
            if (fn) {
              fn(function(err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (args.length <= 1) {
                  args = args[0];
                }
                callback2.call(null, err, args);
              });
            }
          }, callback);
        } else {
          var results = {};
          eachfn.each(_keys(tasks), function(k, callback2) {
            tasks[k](function(err) {
              var args = Array.prototype.slice.call(arguments, 1);
              if (args.length <= 1) {
                args = args[0];
              }
              results[k] = args;
              callback2(err);
            });
          }, function(err) {
            callback(err, results);
          });
        }
      };
      async2.parallel = function(tasks, callback) {
        _parallel({ map: async2.map, each: async2.each }, tasks, callback);
      };
      async2.parallelLimit = function(tasks, limit, callback) {
        _parallel({ map: _mapLimit(limit), each: _eachLimit(limit) }, tasks, callback);
      };
      async2.series = function(tasks, callback) {
        callback = callback || function() {
        };
        if (tasks.constructor === Array) {
          async2.mapSeries(tasks, function(fn, callback2) {
            if (fn) {
              fn(function(err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (args.length <= 1) {
                  args = args[0];
                }
                callback2.call(null, err, args);
              });
            }
          }, callback);
        } else {
          var results = {};
          async2.eachSeries(_keys(tasks), function(k, callback2) {
            tasks[k](function(err) {
              var args = Array.prototype.slice.call(arguments, 1);
              if (args.length <= 1) {
                args = args[0];
              }
              results[k] = args;
              callback2(err);
            });
          }, function(err) {
            callback(err, results);
          });
        }
      };
      async2.iterator = function(tasks) {
        var makeCallback = function(index) {
          var fn = function() {
            if (tasks.length) {
              tasks[index].apply(null, arguments);
            }
            return fn.next();
          };
          fn.next = function() {
            return index < tasks.length - 1 ? makeCallback(index + 1) : null;
          };
          return fn;
        };
        return makeCallback(0);
      };
      async2.apply = function(fn) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function() {
          return fn.apply(
            null,
            args.concat(Array.prototype.slice.call(arguments))
          );
        };
      };
      var _concat = function(eachfn, arr, fn, callback) {
        var r = [];
        eachfn(arr, function(x, cb) {
          fn(x, function(err, y) {
            r = r.concat(y || []);
            cb(err);
          });
        }, function(err) {
          callback(err, r);
        });
      };
      async2.concat = doParallel(_concat);
      async2.concatSeries = doSeries(_concat);
      async2.whilst = function(test, iterator, callback) {
        if (test()) {
          iterator(function(err) {
            if (err) {
              return callback(err);
            }
            async2.whilst(test, iterator, callback);
          });
        } else {
          callback();
        }
      };
      async2.doWhilst = function(iterator, test, callback) {
        iterator(function(err) {
          if (err) {
            return callback(err);
          }
          if (test()) {
            async2.doWhilst(iterator, test, callback);
          } else {
            callback();
          }
        });
      };
      async2.until = function(test, iterator, callback) {
        if (!test()) {
          iterator(function(err) {
            if (err) {
              return callback(err);
            }
            async2.until(test, iterator, callback);
          });
        } else {
          callback();
        }
      };
      async2.doUntil = function(iterator, test, callback) {
        iterator(function(err) {
          if (err) {
            return callback(err);
          }
          if (!test()) {
            async2.doUntil(iterator, test, callback);
          } else {
            callback();
          }
        });
      };
      async2.queue = function(worker, concurrency) {
        if (concurrency === void 0) {
          concurrency = 1;
        }
        function _insert(q2, data, pos, callback) {
          if (data.constructor !== Array) {
            data = [data];
          }
          _each(data, function(task) {
            var item = {
              data: task,
              callback: typeof callback === "function" ? callback : null
            };
            if (pos) {
              q2.tasks.unshift(item);
            } else {
              q2.tasks.push(item);
            }
            if (q2.saturated && q2.tasks.length === concurrency) {
              q2.saturated();
            }
            async2.setImmediate(q2.process);
          });
        }
        var workers = 0;
        var q = {
          tasks: [],
          concurrency,
          saturated: null,
          empty: null,
          drain: null,
          push: function(data, callback) {
            _insert(q, data, false, callback);
          },
          unshift: function(data, callback) {
            _insert(q, data, true, callback);
          },
          process: function() {
            if (workers < q.concurrency && q.tasks.length) {
              var task = q.tasks.shift();
              if (q.empty && q.tasks.length === 0) {
                q.empty();
              }
              workers += 1;
              var next = function() {
                workers -= 1;
                if (task.callback) {
                  task.callback.apply(task, arguments);
                }
                if (q.drain && q.tasks.length + workers === 0) {
                  q.drain();
                }
                q.process();
              };
              var cb = only_once(next);
              worker(task.data, cb);
            }
          },
          length: function() {
            return q.tasks.length;
          },
          running: function() {
            return workers;
          }
        };
        return q;
      };
      async2.cargo = function(worker, payload) {
        var working = false, tasks = [];
        var cargo = {
          tasks,
          payload,
          saturated: null,
          empty: null,
          drain: null,
          push: function(data, callback) {
            if (data.constructor !== Array) {
              data = [data];
            }
            _each(data, function(task) {
              tasks.push({
                data: task,
                callback: typeof callback === "function" ? callback : null
              });
              if (cargo.saturated && tasks.length === payload) {
                cargo.saturated();
              }
            });
            async2.setImmediate(cargo.process);
          },
          process: function process2() {
            if (working) return;
            if (tasks.length === 0) {
              if (cargo.drain) cargo.drain();
              return;
            }
            var ts = typeof payload === "number" ? tasks.splice(0, payload) : tasks.splice(0);
            var ds = _map(ts, function(task) {
              return task.data;
            });
            if (cargo.empty) cargo.empty();
            working = true;
            worker(ds, function() {
              working = false;
              var args = arguments;
              _each(ts, function(data) {
                if (data.callback) {
                  data.callback.apply(null, args);
                }
              });
              process2();
            });
          },
          length: function() {
            return tasks.length;
          },
          running: function() {
            return working;
          }
        };
        return cargo;
      };
      var _console_fn = function(name2) {
        return function(fn) {
          var args = Array.prototype.slice.call(arguments, 1);
          fn.apply(null, args.concat([function(err) {
            var args2 = Array.prototype.slice.call(arguments, 1);
            if (typeof console !== "undefined") {
              if (err) {
                if (console.error) {
                  console.error(err);
                }
              } else if (console[name2]) {
                _each(args2, function(x) {
                  console[name2](x);
                });
              }
            }
          }]));
        };
      };
      async2.log = _console_fn("log");
      async2.dir = _console_fn("dir");
      async2.memoize = function(fn, hasher) {
        var memo = {};
        var queues = {};
        hasher = hasher || function(x) {
          return x;
        };
        var memoized = function() {
          var args = Array.prototype.slice.call(arguments);
          var callback = args.pop();
          var key = hasher.apply(null, args);
          if (key in memo) {
            callback.apply(null, memo[key]);
          } else if (key in queues) {
            queues[key].push(callback);
          } else {
            queues[key] = [callback];
            fn.apply(null, args.concat([function() {
              memo[key] = arguments;
              var q = queues[key];
              delete queues[key];
              for (var i = 0, l = q.length; i < l; i++) {
                q[i].apply(null, arguments);
              }
            }]));
          }
        };
        memoized.memo = memo;
        memoized.unmemoized = fn;
        return memoized;
      };
      async2.unmemoize = function(fn) {
        return function() {
          return (fn.unmemoized || fn).apply(null, arguments);
        };
      };
      async2.times = function(count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
          counter.push(i);
        }
        return async2.map(counter, iterator, callback);
      };
      async2.timesSeries = function(count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
          counter.push(i);
        }
        return async2.mapSeries(counter, iterator, callback);
      };
      async2.compose = function() {
        var fns = Array.prototype.reverse.call(arguments);
        return function() {
          var that = this;
          var args = Array.prototype.slice.call(arguments);
          var callback = args.pop();
          async2.reduce(
            fns,
            args,
            function(newargs, fn, cb) {
              fn.apply(that, newargs.concat([function() {
                var err = arguments[0];
                var nextargs = Array.prototype.slice.call(arguments, 1);
                cb(err, nextargs);
              }]));
            },
            function(err, results) {
              callback.apply(that, [err].concat(results));
            }
          );
        };
      };
      var _applyEach = function(eachfn, fns) {
        var go = function() {
          var that = this;
          var args2 = Array.prototype.slice.call(arguments);
          var callback = args2.pop();
          return eachfn(
            fns,
            function(fn, cb) {
              fn.apply(that, args2.concat([cb]));
            },
            callback
          );
        };
        if (arguments.length > 2) {
          var args = Array.prototype.slice.call(arguments, 2);
          return go.apply(this, args);
        } else {
          return go;
        }
      };
      async2.applyEach = doParallel(_applyEach);
      async2.applyEachSeries = doSeries(_applyEach);
      async2.forever = function(fn, callback) {
        function next(err) {
          if (err) {
            if (callback) {
              return callback(err);
            }
            throw err;
          }
          fn(next);
        }
        next();
      };
      if (module.exports) {
        module.exports = async2;
      } else {
        root.async = async2;
      }
    })();
  })(async);
  return async.exports;
}
var processor;
var hasRequiredProcessor;
function requireProcessor() {
  if (hasRequiredProcessor) return processor;
  hasRequiredProcessor = 1;
  var spawn = require$$0$1.spawn;
  var async2 = requireAsync();
  var utils2 = utilsExports;
  function runFfprobe(command) {
    const inputProbeIndex = 0;
    if (command._inputs[inputProbeIndex].isStream) {
      return;
    }
    command.ffprobe(inputProbeIndex, function(err, data) {
      command._ffprobeData = data;
    });
  }
  processor = function(proto) {
    proto._spawnFfmpeg = function(args, options, processCB, endCB) {
      if (typeof options === "function") {
        endCB = processCB;
        processCB = options;
        options = {};
      }
      if (typeof endCB === "undefined") {
        endCB = processCB;
        processCB = function() {
        };
      }
      var maxLines = "stdoutLines" in options ? options.stdoutLines : this.options.stdoutLines;
      this._getFfmpegPath(function(err, command) {
        if (err) {
          return endCB(err);
        } else if (!command || command.length === 0) {
          return endCB(new Error("Cannot find ffmpeg"));
        }
        if (options.niceness && options.niceness !== 0 && !utils2.isWindows) {
          args.unshift("-n", options.niceness, command);
          command = "nice";
        }
        var stdoutRing = utils2.linesRing(maxLines);
        var stdoutClosed = false;
        var stderrRing = utils2.linesRing(maxLines);
        var stderrClosed = false;
        var ffmpegProc = spawn(command, args, options);
        if (ffmpegProc.stderr) {
          ffmpegProc.stderr.setEncoding("utf8");
        }
        ffmpegProc.on("error", function(err2) {
          endCB(err2);
        });
        var exitError = null;
        function handleExit(err2) {
          if (err2) {
            exitError = err2;
          }
          if (processExited && (stdoutClosed || !options.captureStdout) && stderrClosed) {
            endCB(exitError, stdoutRing, stderrRing);
          }
        }
        var processExited = false;
        ffmpegProc.on("exit", function(code, signal) {
          processExited = true;
          if (signal) {
            handleExit(new Error("ffmpeg was killed with signal " + signal));
          } else if (code) {
            handleExit(new Error("ffmpeg exited with code " + code));
          } else {
            handleExit();
          }
        });
        if (options.captureStdout) {
          ffmpegProc.stdout.on("data", function(data) {
            stdoutRing.append(data);
          });
          ffmpegProc.stdout.on("close", function() {
            stdoutRing.close();
            stdoutClosed = true;
            handleExit();
          });
        }
        ffmpegProc.stderr.on("data", function(data) {
          stderrRing.append(data);
        });
        ffmpegProc.stderr.on("close", function() {
          stderrRing.close();
          stderrClosed = true;
          handleExit();
        });
        processCB(ffmpegProc, stdoutRing, stderrRing);
      });
    };
    proto._getArguments = function() {
      var complexFilters = this._complexFilters.get();
      var fileOutput = this._outputs.some(function(output2) {
        return output2.isFile;
      });
      return [].concat(
        // Inputs and input options
        this._inputs.reduce(function(args, input) {
          var source = typeof input.source === "string" ? input.source : "pipe:0";
          return args.concat(
            input.options.get(),
            ["-i", source]
          );
        }, []),
        // Global options
        this._global.get(),
        // Overwrite if we have file outputs
        fileOutput ? ["-y"] : [],
        // Complex filters
        complexFilters,
        // Outputs, filters and output options
        this._outputs.reduce(function(args, output2) {
          var sizeFilters = utils2.makeFilterStrings(output2.sizeFilters.get());
          var audioFilters = output2.audioFilters.get();
          var videoFilters = output2.videoFilters.get().concat(sizeFilters);
          var outputArg;
          if (!output2.target) {
            outputArg = [];
          } else if (typeof output2.target === "string") {
            outputArg = [output2.target];
          } else {
            outputArg = ["pipe:1"];
          }
          return args.concat(
            output2.audio.get(),
            audioFilters.length ? ["-filter:a", audioFilters.join(",")] : [],
            output2.video.get(),
            videoFilters.length ? ["-filter:v", videoFilters.join(",")] : [],
            output2.options.get(),
            outputArg
          );
        }, [])
      );
    };
    proto._prepare = function(callback, readMetadata) {
      var self2 = this;
      async2.waterfall([
        // Check codecs and formats
        function(cb) {
          self2._checkCapabilities(cb);
        },
        // Read metadata if required
        function(cb) {
          if (!readMetadata) {
            return cb();
          }
          self2.ffprobe(0, function(err, data) {
            if (!err) {
              self2._ffprobeData = data;
            }
            cb();
          });
        },
        // Check for flvtool2/flvmeta if necessary
        function(cb) {
          var flvmeta = self2._outputs.some(function(output2) {
            if (output2.flags.flvmeta && !output2.isFile) {
              self2.logger.warn("Updating flv metadata is only supported for files");
              output2.flags.flvmeta = false;
            }
            return output2.flags.flvmeta;
          });
          if (flvmeta) {
            self2._getFlvtoolPath(function(err) {
              cb(err);
            });
          } else {
            cb();
          }
        },
        // Build argument list
        function(cb) {
          var args;
          try {
            args = self2._getArguments();
          } catch (e) {
            return cb(e);
          }
          cb(null, args);
        },
        // Add "-strict experimental" option where needed
        function(args, cb) {
          self2.availableEncoders(function(err, encoders) {
            for (var i = 0; i < args.length; i++) {
              if (args[i] === "-acodec" || args[i] === "-vcodec") {
                i++;
                if (args[i] in encoders && encoders[args[i]].experimental) {
                  args.splice(i + 1, 0, "-strict", "experimental");
                  i += 2;
                }
              }
            }
            cb(null, args);
          });
        }
      ], callback);
      if (!readMetadata) {
        if (this.listeners("progress").length > 0) {
          runFfprobe(this);
        } else {
          this.once("newListener", function(event) {
            if (event === "progress") {
              runFfprobe(this);
            }
          });
        }
      }
    };
    proto.exec = proto.execute = proto.run = function() {
      var self2 = this;
      var outputPresent = this._outputs.some(function(output2) {
        return "target" in output2;
      });
      if (!outputPresent) {
        throw new Error("No output specified");
      }
      var outputStream = this._outputs.filter(function(output2) {
        return typeof output2.target !== "string";
      })[0];
      var inputStream = this._inputs.filter(function(input) {
        return typeof input.source !== "string";
      })[0];
      var ended = false;
      function emitEnd(err, stdout, stderr) {
        if (!ended) {
          ended = true;
          if (err) {
            self2.emit("error", err, stdout, stderr);
          } else {
            self2.emit("end", stdout, stderr);
          }
        }
      }
      self2._prepare(function(err, args) {
        if (err) {
          return emitEnd(err);
        }
        self2._spawnFfmpeg(
          args,
          {
            captureStdout: !outputStream,
            niceness: self2.options.niceness,
            cwd: self2.options.cwd,
            windowsHide: true
          },
          function processCB(ffmpegProc, stdoutRing, stderrRing) {
            self2.ffmpegProc = ffmpegProc;
            self2.emit("start", "ffmpeg " + args.join(" "));
            if (inputStream) {
              inputStream.source.on("error", function(err2) {
                var reportingErr = new Error("Input stream error: " + err2.message);
                reportingErr.inputStreamError = err2;
                emitEnd(reportingErr);
                ffmpegProc.kill();
              });
              inputStream.source.resume();
              inputStream.source.pipe(ffmpegProc.stdin);
              ffmpegProc.stdin.on("error", function() {
              });
            }
            if (self2.options.timeout) {
              self2.processTimer = setTimeout(function() {
                var msg = "process ran into a timeout (" + self2.options.timeout + "s)";
                emitEnd(new Error(msg), stdoutRing.get(), stderrRing.get());
                ffmpegProc.kill();
              }, self2.options.timeout * 1e3);
            }
            if (outputStream) {
              ffmpegProc.stdout.pipe(outputStream.target, outputStream.pipeopts);
              outputStream.target.on("close", function() {
                self2.logger.debug("Output stream closed, scheduling kill for ffmpeg process");
                setTimeout(function() {
                  emitEnd(new Error("Output stream closed"));
                  ffmpegProc.kill();
                }, 20);
              });
              outputStream.target.on("error", function(err2) {
                self2.logger.debug("Output stream error, killing ffmpeg process");
                var reportingErr = new Error("Output stream error: " + err2.message);
                reportingErr.outputStreamError = err2;
                emitEnd(reportingErr, stdoutRing.get(), stderrRing.get());
                ffmpegProc.kill("SIGKILL");
              });
            }
            if (stderrRing) {
              if (self2.listeners("stderr").length) {
                stderrRing.callback(function(line) {
                  self2.emit("stderr", line);
                });
              }
              if (self2.listeners("codecData").length) {
                var codecDataSent = false;
                var codecObject = {};
                stderrRing.callback(function(line) {
                  if (!codecDataSent)
                    codecDataSent = utils2.extractCodecData(self2, line, codecObject);
                });
              }
              if (self2.listeners("progress").length) {
                stderrRing.callback(function(line) {
                  utils2.extractProgress(self2, line);
                });
              }
            }
          },
          function endCB(err2, stdoutRing, stderrRing) {
            clearTimeout(self2.processTimer);
            delete self2.ffmpegProc;
            if (err2) {
              if (err2.message.match(/ffmpeg exited with code/)) {
                err2.message += ": " + utils2.extractError(stderrRing.get());
              }
              emitEnd(err2, stdoutRing.get(), stderrRing.get());
            } else {
              var flvmeta = self2._outputs.filter(function(output2) {
                return output2.flags.flvmeta;
              });
              if (flvmeta.length) {
                self2._getFlvtoolPath(function(err3, flvtool) {
                  if (err3) {
                    return emitEnd(err3);
                  }
                  async2.each(
                    flvmeta,
                    function(output2, cb) {
                      spawn(flvtool, ["-U", output2.target], { windowsHide: true }).on("error", function(err4) {
                        cb(new Error("Error running " + flvtool + " on " + output2.target + ": " + err4.message));
                      }).on("exit", function(code, signal) {
                        if (code !== 0 || signal) {
                          cb(
                            new Error(flvtool + " " + (signal ? "received signal " + signal : "exited with code " + code)) + " when running on " + output2.target
                          );
                        } else {
                          cb();
                        }
                      });
                    },
                    function(err4) {
                      if (err4) {
                        emitEnd(err4);
                      } else {
                        emitEnd(null, stdoutRing.get(), stderrRing.get());
                      }
                    }
                  );
                });
              } else {
                emitEnd(null, stdoutRing.get(), stderrRing.get());
              }
            }
          }
        );
      });
      return this;
    };
    proto.renice = function(niceness) {
      if (!utils2.isWindows) {
        niceness = niceness || 0;
        if (niceness < -20 || niceness > 20) {
          this.logger.warn("Invalid niceness value: " + niceness + ", must be between -20 and 20");
        }
        niceness = Math.min(20, Math.max(-20, niceness));
        this.options.niceness = niceness;
        if (this.ffmpegProc) {
          var logger = this.logger;
          var pid = this.ffmpegProc.pid;
          var renice = spawn("renice", [niceness, "-p", pid], { windowsHide: true });
          renice.on("error", function(err) {
            logger.warn("could not renice process " + pid + ": " + err.message);
          });
          renice.on("exit", function(code, signal) {
            if (signal) {
              logger.warn("could not renice process " + pid + ": renice was killed by signal " + signal);
            } else if (code) {
              logger.warn("could not renice process " + pid + ": renice exited with " + code);
            } else {
              logger.info("successfully reniced process " + pid + " to " + niceness + " niceness");
            }
          });
        }
      }
      return this;
    };
    proto.kill = function(signal) {
      if (!this.ffmpegProc) {
        this.logger.warn("No running ffmpeg process, cannot send signal");
      } else {
        this.ffmpegProc.kill(signal || "SIGKILL");
      }
      return this;
    };
  };
  return processor;
}
var capabilities;
var hasRequiredCapabilities;
function requireCapabilities() {
  if (hasRequiredCapabilities) return capabilities;
  hasRequiredCapabilities = 1;
  var fs$12 = fs;
  var path = path$3;
  var async2 = requireAsync();
  var utils2 = utilsExports;
  var avCodecRegexp = /^\s*([D ])([E ])([VAS])([S ])([D ])([T ]) ([^ ]+) +(.*)$/;
  var ffCodecRegexp = /^\s*([D\.])([E\.])([VAS])([I\.])([L\.])([S\.]) ([^ ]+) +(.*)$/;
  var ffEncodersRegexp = /\(encoders:([^\)]+)\)/;
  var ffDecodersRegexp = /\(decoders:([^\)]+)\)/;
  var encodersRegexp = /^\s*([VAS\.])([F\.])([S\.])([X\.])([B\.])([D\.]) ([^ ]+) +(.*)$/;
  var formatRegexp = /^\s*([D ])([E ])\s+([^ ]+)\s+(.*)$/;
  var lineBreakRegexp = /\r\n|\r|\n/;
  var filterRegexp = /^(?: [T\.][S\.][C\.] )?([^ ]+) +(AA?|VV?|\|)->(AA?|VV?|\|) +(.*)$/;
  var cache = {};
  capabilities = function(proto) {
    proto.setFfmpegPath = function(ffmpegPath2) {
      cache.ffmpegPath = ffmpegPath2;
      return this;
    };
    proto.setFfprobePath = function(ffprobePath) {
      cache.ffprobePath = ffprobePath;
      return this;
    };
    proto.setFlvtoolPath = function(flvtool) {
      cache.flvtoolPath = flvtool;
      return this;
    };
    proto._forgetPaths = function() {
      delete cache.ffmpegPath;
      delete cache.ffprobePath;
      delete cache.flvtoolPath;
    };
    proto._getFfmpegPath = function(callback) {
      if ("ffmpegPath" in cache) {
        return callback(null, cache.ffmpegPath);
      }
      async2.waterfall([
        // Try FFMPEG_PATH
        function(cb) {
          if (process.env.FFMPEG_PATH) {
            fs$12.exists(process.env.FFMPEG_PATH, function(exists) {
              if (exists) {
                cb(null, process.env.FFMPEG_PATH);
              } else {
                cb(null, "");
              }
            });
          } else {
            cb(null, "");
          }
        },
        // Search in the PATH
        function(ffmpeg2, cb) {
          if (ffmpeg2.length) {
            return cb(null, ffmpeg2);
          }
          utils2.which("ffmpeg", function(err, ffmpeg22) {
            cb(err, ffmpeg22);
          });
        }
      ], function(err, ffmpeg2) {
        if (err) {
          callback(err);
        } else {
          callback(null, cache.ffmpegPath = ffmpeg2 || "");
        }
      });
    };
    proto._getFfprobePath = function(callback) {
      var self2 = this;
      if ("ffprobePath" in cache) {
        return callback(null, cache.ffprobePath);
      }
      async2.waterfall([
        // Try FFPROBE_PATH
        function(cb) {
          if (process.env.FFPROBE_PATH) {
            fs$12.exists(process.env.FFPROBE_PATH, function(exists) {
              cb(null, exists ? process.env.FFPROBE_PATH : "");
            });
          } else {
            cb(null, "");
          }
        },
        // Search in the PATH
        function(ffprobe2, cb) {
          if (ffprobe2.length) {
            return cb(null, ffprobe2);
          }
          utils2.which("ffprobe", function(err, ffprobe22) {
            cb(err, ffprobe22);
          });
        },
        // Search in the same directory as ffmpeg
        function(ffprobe2, cb) {
          if (ffprobe2.length) {
            return cb(null, ffprobe2);
          }
          self2._getFfmpegPath(function(err, ffmpeg2) {
            if (err) {
              cb(err);
            } else if (ffmpeg2.length) {
              var name2 = utils2.isWindows ? "ffprobe.exe" : "ffprobe";
              var ffprobe22 = path.join(path.dirname(ffmpeg2), name2);
              fs$12.exists(ffprobe22, function(exists) {
                cb(null, exists ? ffprobe22 : "");
              });
            } else {
              cb(null, "");
            }
          });
        }
      ], function(err, ffprobe2) {
        if (err) {
          callback(err);
        } else {
          callback(null, cache.ffprobePath = ffprobe2 || "");
        }
      });
    };
    proto._getFlvtoolPath = function(callback) {
      if ("flvtoolPath" in cache) {
        return callback(null, cache.flvtoolPath);
      }
      async2.waterfall([
        // Try FLVMETA_PATH
        function(cb) {
          if (process.env.FLVMETA_PATH) {
            fs$12.exists(process.env.FLVMETA_PATH, function(exists) {
              cb(null, exists ? process.env.FLVMETA_PATH : "");
            });
          } else {
            cb(null, "");
          }
        },
        // Try FLVTOOL2_PATH
        function(flvtool, cb) {
          if (flvtool.length) {
            return cb(null, flvtool);
          }
          if (process.env.FLVTOOL2_PATH) {
            fs$12.exists(process.env.FLVTOOL2_PATH, function(exists) {
              cb(null, exists ? process.env.FLVTOOL2_PATH : "");
            });
          } else {
            cb(null, "");
          }
        },
        // Search for flvmeta in the PATH
        function(flvtool, cb) {
          if (flvtool.length) {
            return cb(null, flvtool);
          }
          utils2.which("flvmeta", function(err, flvmeta) {
            cb(err, flvmeta);
          });
        },
        // Search for flvtool2 in the PATH
        function(flvtool, cb) {
          if (flvtool.length) {
            return cb(null, flvtool);
          }
          utils2.which("flvtool2", function(err, flvtool2) {
            cb(err, flvtool2);
          });
        }
      ], function(err, flvtool) {
        if (err) {
          callback(err);
        } else {
          callback(null, cache.flvtoolPath = flvtool || "");
        }
      });
    };
    proto.availableFilters = proto.getAvailableFilters = function(callback) {
      if ("filters" in cache) {
        return callback(null, cache.filters);
      }
      this._spawnFfmpeg(["-filters"], { captureStdout: true, stdoutLines: 0 }, function(err, stdoutRing) {
        if (err) {
          return callback(err);
        }
        var stdout = stdoutRing.get();
        var lines = stdout.split("\n");
        var data = {};
        var types2 = { A: "audio", V: "video", "|": "none" };
        lines.forEach(function(line) {
          var match = line.match(filterRegexp);
          if (match) {
            data[match[1]] = {
              description: match[4],
              input: types2[match[2].charAt(0)],
              multipleInputs: match[2].length > 1,
              output: types2[match[3].charAt(0)],
              multipleOutputs: match[3].length > 1
            };
          }
        });
        callback(null, cache.filters = data);
      });
    };
    proto.availableCodecs = proto.getAvailableCodecs = function(callback) {
      if ("codecs" in cache) {
        return callback(null, cache.codecs);
      }
      this._spawnFfmpeg(["-codecs"], { captureStdout: true, stdoutLines: 0 }, function(err, stdoutRing) {
        if (err) {
          return callback(err);
        }
        var stdout = stdoutRing.get();
        var lines = stdout.split(lineBreakRegexp);
        var data = {};
        lines.forEach(function(line) {
          var match = line.match(avCodecRegexp);
          if (match && match[7] !== "=") {
            data[match[7]] = {
              type: { "V": "video", "A": "audio", "S": "subtitle" }[match[3]],
              description: match[8],
              canDecode: match[1] === "D",
              canEncode: match[2] === "E",
              drawHorizBand: match[4] === "S",
              directRendering: match[5] === "D",
              weirdFrameTruncation: match[6] === "T"
            };
          }
          match = line.match(ffCodecRegexp);
          if (match && match[7] !== "=") {
            var codecData = data[match[7]] = {
              type: { "V": "video", "A": "audio", "S": "subtitle" }[match[3]],
              description: match[8],
              canDecode: match[1] === "D",
              canEncode: match[2] === "E",
              intraFrameOnly: match[4] === "I",
              isLossy: match[5] === "L",
              isLossless: match[6] === "S"
            };
            var encoders = codecData.description.match(ffEncodersRegexp);
            encoders = encoders ? encoders[1].trim().split(" ") : [];
            var decoders = codecData.description.match(ffDecodersRegexp);
            decoders = decoders ? decoders[1].trim().split(" ") : [];
            if (encoders.length || decoders.length) {
              var coderData = {};
              utils2.copy(codecData, coderData);
              delete coderData.canEncode;
              delete coderData.canDecode;
              encoders.forEach(function(name2) {
                data[name2] = {};
                utils2.copy(coderData, data[name2]);
                data[name2].canEncode = true;
              });
              decoders.forEach(function(name2) {
                if (name2 in data) {
                  data[name2].canDecode = true;
                } else {
                  data[name2] = {};
                  utils2.copy(coderData, data[name2]);
                  data[name2].canDecode = true;
                }
              });
            }
          }
        });
        callback(null, cache.codecs = data);
      });
    };
    proto.availableEncoders = proto.getAvailableEncoders = function(callback) {
      if ("encoders" in cache) {
        return callback(null, cache.encoders);
      }
      this._spawnFfmpeg(["-encoders"], { captureStdout: true, stdoutLines: 0 }, function(err, stdoutRing) {
        if (err) {
          return callback(err);
        }
        var stdout = stdoutRing.get();
        var lines = stdout.split(lineBreakRegexp);
        var data = {};
        lines.forEach(function(line) {
          var match = line.match(encodersRegexp);
          if (match && match[7] !== "=") {
            data[match[7]] = {
              type: { "V": "video", "A": "audio", "S": "subtitle" }[match[1]],
              description: match[8],
              frameMT: match[2] === "F",
              sliceMT: match[3] === "S",
              experimental: match[4] === "X",
              drawHorizBand: match[5] === "B",
              directRendering: match[6] === "D"
            };
          }
        });
        callback(null, cache.encoders = data);
      });
    };
    proto.availableFormats = proto.getAvailableFormats = function(callback) {
      if ("formats" in cache) {
        return callback(null, cache.formats);
      }
      this._spawnFfmpeg(["-formats"], { captureStdout: true, stdoutLines: 0 }, function(err, stdoutRing) {
        if (err) {
          return callback(err);
        }
        var stdout = stdoutRing.get();
        var lines = stdout.split(lineBreakRegexp);
        var data = {};
        lines.forEach(function(line) {
          var match = line.match(formatRegexp);
          if (match) {
            match[3].split(",").forEach(function(format) {
              if (!(format in data)) {
                data[format] = {
                  description: match[4],
                  canDemux: false,
                  canMux: false
                };
              }
              if (match[1] === "D") {
                data[format].canDemux = true;
              }
              if (match[2] === "E") {
                data[format].canMux = true;
              }
            });
          }
        });
        callback(null, cache.formats = data);
      });
    };
    proto._checkCapabilities = function(callback) {
      var self2 = this;
      async2.waterfall([
        // Get available formats
        function(cb) {
          self2.availableFormats(cb);
        },
        // Check whether specified formats are available
        function(formats, cb) {
          var unavailable;
          unavailable = self2._outputs.reduce(function(fmts, output2) {
            var format = output2.options.find("-f", 1);
            if (format) {
              if (!(format[0] in formats) || !formats[format[0]].canMux) {
                fmts.push(format);
              }
            }
            return fmts;
          }, []);
          if (unavailable.length === 1) {
            return cb(new Error("Output format " + unavailable[0] + " is not available"));
          } else if (unavailable.length > 1) {
            return cb(new Error("Output formats " + unavailable.join(", ") + " are not available"));
          }
          unavailable = self2._inputs.reduce(function(fmts, input) {
            var format = input.options.find("-f", 1);
            if (format) {
              if (!(format[0] in formats) || !formats[format[0]].canDemux) {
                fmts.push(format[0]);
              }
            }
            return fmts;
          }, []);
          if (unavailable.length === 1) {
            return cb(new Error("Input format " + unavailable[0] + " is not available"));
          } else if (unavailable.length > 1) {
            return cb(new Error("Input formats " + unavailable.join(", ") + " are not available"));
          }
          cb();
        },
        // Get available codecs
        function(cb) {
          self2.availableEncoders(cb);
        },
        // Check whether specified codecs are available and add strict experimental options if needed
        function(encoders, cb) {
          var unavailable;
          unavailable = self2._outputs.reduce(function(cdcs, output2) {
            var acodec = output2.audio.find("-acodec", 1);
            if (acodec && acodec[0] !== "copy") {
              if (!(acodec[0] in encoders) || encoders[acodec[0]].type !== "audio") {
                cdcs.push(acodec[0]);
              }
            }
            return cdcs;
          }, []);
          if (unavailable.length === 1) {
            return cb(new Error("Audio codec " + unavailable[0] + " is not available"));
          } else if (unavailable.length > 1) {
            return cb(new Error("Audio codecs " + unavailable.join(", ") + " are not available"));
          }
          unavailable = self2._outputs.reduce(function(cdcs, output2) {
            var vcodec = output2.video.find("-vcodec", 1);
            if (vcodec && vcodec[0] !== "copy") {
              if (!(vcodec[0] in encoders) || encoders[vcodec[0]].type !== "video") {
                cdcs.push(vcodec[0]);
              }
            }
            return cdcs;
          }, []);
          if (unavailable.length === 1) {
            return cb(new Error("Video codec " + unavailable[0] + " is not available"));
          } else if (unavailable.length > 1) {
            return cb(new Error("Video codecs " + unavailable.join(", ") + " are not available"));
          }
          cb();
        }
      ], callback);
    };
  };
  return capabilities;
}
var ffprobe;
var hasRequiredFfprobe;
function requireFfprobe() {
  if (hasRequiredFfprobe) return ffprobe;
  hasRequiredFfprobe = 1;
  var spawn = require$$0$1.spawn;
  function legacyTag(key) {
    return key.match(/^TAG:/);
  }
  function legacyDisposition(key) {
    return key.match(/^DISPOSITION:/);
  }
  function parseFfprobeOutput(out) {
    var lines = out.split(/\r\n|\r|\n/);
    lines = lines.filter(function(line2) {
      return line2.length > 0;
    });
    var data = {
      streams: [],
      format: {},
      chapters: []
    };
    function parseBlock(name2) {
      var data2 = {};
      var line2 = lines.shift();
      while (typeof line2 !== "undefined") {
        if (line2.toLowerCase() == "[/" + name2 + "]") {
          return data2;
        } else if (line2.match(/^\[/)) {
          line2 = lines.shift();
          continue;
        }
        var kv = line2.match(/^([^=]+)=(.*)$/);
        if (kv) {
          if (!kv[1].match(/^TAG:/) && kv[2].match(/^[0-9]+(\.[0-9]+)?$/)) {
            data2[kv[1]] = Number(kv[2]);
          } else {
            data2[kv[1]] = kv[2];
          }
        }
        line2 = lines.shift();
      }
      return data2;
    }
    var line = lines.shift();
    while (typeof line !== "undefined") {
      if (line.match(/^\[stream/i)) {
        var stream = parseBlock("stream");
        data.streams.push(stream);
      } else if (line.match(/^\[chapter/i)) {
        var chapter = parseBlock("chapter");
        data.chapters.push(chapter);
      } else if (line.toLowerCase() === "[format]") {
        data.format = parseBlock("format");
      }
      line = lines.shift();
    }
    return data;
  }
  ffprobe = function(proto) {
    proto.ffprobe = function() {
      var input, index = null, options = [], callback;
      var callback = arguments[arguments.length - 1];
      var ended = false;
      function handleCallback(err, data) {
        if (!ended) {
          ended = true;
          callback(err, data);
        }
      }
      switch (arguments.length) {
        case 3:
          index = arguments[0];
          options = arguments[1];
          break;
        case 2:
          if (typeof arguments[0] === "number") {
            index = arguments[0];
          } else if (Array.isArray(arguments[0])) {
            options = arguments[0];
          }
          break;
      }
      if (index === null) {
        if (!this._currentInput) {
          return handleCallback(new Error("No input specified"));
        }
        input = this._currentInput;
      } else {
        input = this._inputs[index];
        if (!input) {
          return handleCallback(new Error("Invalid input index"));
        }
      }
      this._getFfprobePath(function(err, path) {
        if (err) {
          return handleCallback(err);
        } else if (!path) {
          return handleCallback(new Error("Cannot find ffprobe"));
        }
        var stdout = "";
        var stdoutClosed = false;
        var stderr = "";
        var stderrClosed = false;
        var src = input.isStream ? "pipe:0" : input.source;
        var ffprobe2 = spawn(path, ["-show_streams", "-show_format"].concat(options, src), { windowsHide: true });
        if (input.isStream) {
          ffprobe2.stdin.on("error", function(err2) {
            if (["ECONNRESET", "EPIPE", "EOF"].indexOf(err2.code) >= 0) {
              return;
            }
            handleCallback(err2);
          });
          ffprobe2.stdin.on("close", function() {
            input.source.pause();
            input.source.unpipe(ffprobe2.stdin);
          });
          input.source.pipe(ffprobe2.stdin);
        }
        ffprobe2.on("error", callback);
        var exitError = null;
        function handleExit(err2) {
          if (err2) {
            exitError = err2;
          }
          if (processExited && stdoutClosed && stderrClosed) {
            if (exitError) {
              if (stderr) {
                exitError.message += "\n" + stderr;
              }
              return handleCallback(exitError);
            }
            var data = parseFfprobeOutput(stdout);
            [data.format].concat(data.streams).forEach(function(target) {
              if (target) {
                var legacyTagKeys = Object.keys(target).filter(legacyTag);
                if (legacyTagKeys.length) {
                  target.tags = target.tags || {};
                  legacyTagKeys.forEach(function(tagKey) {
                    target.tags[tagKey.substr(4)] = target[tagKey];
                    delete target[tagKey];
                  });
                }
                var legacyDispositionKeys = Object.keys(target).filter(legacyDisposition);
                if (legacyDispositionKeys.length) {
                  target.disposition = target.disposition || {};
                  legacyDispositionKeys.forEach(function(dispositionKey) {
                    target.disposition[dispositionKey.substr(12)] = target[dispositionKey];
                    delete target[dispositionKey];
                  });
                }
              }
            });
            handleCallback(null, data);
          }
        }
        var processExited = false;
        ffprobe2.on("exit", function(code, signal) {
          processExited = true;
          if (code) {
            handleExit(new Error("ffprobe exited with code " + code));
          } else if (signal) {
            handleExit(new Error("ffprobe was killed with signal " + signal));
          } else {
            handleExit();
          }
        });
        ffprobe2.stdout.on("data", function(data) {
          stdout += data;
        });
        ffprobe2.stdout.on("close", function() {
          stdoutClosed = true;
          handleExit();
        });
        ffprobe2.stderr.on("data", function(data) {
          stderr += data;
        });
        ffprobe2.stderr.on("close", function() {
          stderrClosed = true;
          handleExit();
        });
      });
    };
  };
  return ffprobe;
}
var recipes;
var hasRequiredRecipes;
function requireRecipes() {
  if (hasRequiredRecipes) return recipes;
  hasRequiredRecipes = 1;
  var fs$12 = fs;
  var path = path$3;
  var PassThrough = require$$3.PassThrough;
  var async2 = requireAsync();
  var utils2 = utilsExports;
  recipes = function recipes2(proto) {
    proto.saveToFile = proto.save = function(output2) {
      this.output(output2).run();
      return this;
    };
    proto.writeToStream = proto.pipe = proto.stream = function(stream, options) {
      if (stream && !("writable" in stream)) {
        options = stream;
        stream = void 0;
      }
      if (!stream) {
        if (process.version.match(/v0\.8\./)) {
          throw new Error("PassThrough stream is not supported on node v0.8");
        }
        stream = new PassThrough();
      }
      this.output(stream, options).run();
      return stream;
    };
    proto.takeScreenshots = proto.thumbnail = proto.thumbnails = proto.screenshot = proto.screenshots = function(config, folder) {
      var self2 = this;
      var source = this._currentInput.source;
      config = config || { count: 1 };
      if (typeof config === "number") {
        config = {
          count: config
        };
      }
      if (!("folder" in config)) {
        config.folder = folder || ".";
      }
      if ("timestamps" in config) {
        config.timemarks = config.timestamps;
      }
      if (!("timemarks" in config)) {
        if (!config.count) {
          throw new Error("Cannot take screenshots: neither a count nor a timemark list are specified");
        }
        var interval = 100 / (1 + config.count);
        config.timemarks = [];
        for (var i = 0; i < config.count; i++) {
          config.timemarks.push(interval * (i + 1) + "%");
        }
      }
      if ("size" in config) {
        var fixedSize = config.size.match(/^(\d+)x(\d+)$/);
        var fixedWidth = config.size.match(/^(\d+)x\?$/);
        var fixedHeight = config.size.match(/^\?x(\d+)$/);
        var percentSize = config.size.match(/^(\d+)%$/);
        if (!fixedSize && !fixedWidth && !fixedHeight && !percentSize) {
          throw new Error("Invalid size parameter: " + config.size);
        }
      }
      var metadata;
      function getMetadata(cb) {
        if (metadata) {
          cb(null, metadata);
        } else {
          self2.ffprobe(function(err, meta) {
            metadata = meta;
            cb(err, meta);
          });
        }
      }
      async2.waterfall([
        // Compute percent timemarks if any
        function computeTimemarks(next) {
          if (config.timemarks.some(function(t) {
            return ("" + t).match(/^[\d.]+%$/);
          })) {
            if (typeof source !== "string") {
              return next(new Error("Cannot compute screenshot timemarks with an input stream, please specify fixed timemarks"));
            }
            getMetadata(function(err, meta) {
              if (err) {
                next(err);
              } else {
                var vstream = meta.streams.reduce(function(biggest, stream) {
                  if (stream.codec_type === "video" && stream.width * stream.height > biggest.width * biggest.height) {
                    return stream;
                  } else {
                    return biggest;
                  }
                }, { width: 0, height: 0 });
                if (vstream.width === 0) {
                  return next(new Error("No video stream in input, cannot take screenshots"));
                }
                var duration = Number(vstream.duration);
                if (isNaN(duration)) {
                  duration = Number(meta.format.duration);
                }
                if (isNaN(duration)) {
                  return next(new Error("Could not get input duration, please specify fixed timemarks"));
                }
                config.timemarks = config.timemarks.map(function(mark) {
                  if (("" + mark).match(/^([\d.]+)%$/)) {
                    return duration * parseFloat(mark) / 100;
                  } else {
                    return mark;
                  }
                });
                next();
              }
            });
          } else {
            next();
          }
        },
        // Turn all timemarks into numbers and sort them
        function normalizeTimemarks(next) {
          config.timemarks = config.timemarks.map(function(mark) {
            return utils2.timemarkToSeconds(mark);
          }).sort(function(a, b) {
            return a - b;
          });
          next();
        },
        // Add '_%i' to pattern when requesting multiple screenshots and no variable token is present
        function fixPattern(next) {
          var pattern = config.filename || "tn.png";
          if (pattern.indexOf(".") === -1) {
            pattern += ".png";
          }
          if (config.timemarks.length > 1 && !pattern.match(/%(s|0*i)/)) {
            var ext = path.extname(pattern);
            pattern = path.join(path.dirname(pattern), path.basename(pattern, ext) + "_%i" + ext);
          }
          next(null, pattern);
        },
        // Replace filename tokens (%f, %b) in pattern
        function replaceFilenameTokens(pattern, next) {
          if (pattern.match(/%[bf]/)) {
            if (typeof source !== "string") {
              return next(new Error("Cannot replace %f or %b when using an input stream"));
            }
            pattern = pattern.replace(/%f/g, path.basename(source)).replace(/%b/g, path.basename(source, path.extname(source)));
          }
          next(null, pattern);
        },
        // Compute size if needed
        function getSize(pattern, next) {
          if (pattern.match(/%[whr]/)) {
            if (fixedSize) {
              return next(null, pattern, fixedSize[1], fixedSize[2]);
            }
            getMetadata(function(err, meta) {
              if (err) {
                return next(new Error("Could not determine video resolution to replace %w, %h or %r"));
              }
              var vstream = meta.streams.reduce(function(biggest, stream) {
                if (stream.codec_type === "video" && stream.width * stream.height > biggest.width * biggest.height) {
                  return stream;
                } else {
                  return biggest;
                }
              }, { width: 0, height: 0 });
              if (vstream.width === 0) {
                return next(new Error("No video stream in input, cannot replace %w, %h or %r"));
              }
              var width = vstream.width;
              var height = vstream.height;
              if (fixedWidth) {
                height = height * Number(fixedWidth[1]) / width;
                width = Number(fixedWidth[1]);
              } else if (fixedHeight) {
                width = width * Number(fixedHeight[1]) / height;
                height = Number(fixedHeight[1]);
              } else if (percentSize) {
                width = width * Number(percentSize[1]) / 100;
                height = height * Number(percentSize[1]) / 100;
              }
              next(null, pattern, Math.round(width / 2) * 2, Math.round(height / 2) * 2);
            });
          } else {
            next(null, pattern, -1, -1);
          }
        },
        // Replace size tokens (%w, %h, %r) in pattern
        function replaceSizeTokens(pattern, width, height, next) {
          pattern = pattern.replace(/%r/g, "%wx%h").replace(/%w/g, width).replace(/%h/g, height);
          next(null, pattern);
        },
        // Replace variable tokens in pattern (%s, %i) and generate filename list
        function replaceVariableTokens(pattern, next) {
          var filenames = config.timemarks.map(function(t, i2) {
            return pattern.replace(/%s/g, utils2.timemarkToSeconds(t)).replace(/%(0*)i/g, function(match, padding) {
              var idx = "" + (i2 + 1);
              return padding.substr(0, Math.max(0, padding.length + 1 - idx.length)) + idx;
            });
          });
          self2.emit("filenames", filenames);
          next(null, filenames);
        },
        // Create output directory
        function createDirectory(filenames, next) {
          fs$12.exists(config.folder, function(exists) {
            if (!exists) {
              fs$12.mkdir(config.folder, function(err) {
                if (err) {
                  next(err);
                } else {
                  next(null, filenames);
                }
              });
            } else {
              next(null, filenames);
            }
          });
        }
      ], function runCommand(err, filenames) {
        if (err) {
          return self2.emit("error", err);
        }
        var count = config.timemarks.length;
        var split;
        var filters = [split = {
          filter: "split",
          options: count,
          outputs: []
        }];
        if ("size" in config) {
          self2.size(config.size);
          var sizeFilters = self2._currentOutput.sizeFilters.get().map(function(f, i3) {
            if (i3 > 0) {
              f.inputs = "size" + (i3 - 1);
            }
            f.outputs = "size" + i3;
            return f;
          });
          split.inputs = "size" + (sizeFilters.length - 1);
          filters = sizeFilters.concat(filters);
          self2._currentOutput.sizeFilters.clear();
        }
        var first = 0;
        for (var i2 = 0; i2 < count; i2++) {
          var stream = "screen" + i2;
          split.outputs.push(stream);
          if (i2 === 0) {
            first = config.timemarks[i2];
            self2.seekInput(first);
          }
          self2.output(path.join(config.folder, filenames[i2])).frames(1).map(stream);
          if (i2 > 0) {
            self2.seek(config.timemarks[i2] - first);
          }
        }
        self2.complexFilter(filters);
        self2.run();
      });
      return this;
    };
    proto.mergeToFile = proto.concatenate = proto.concat = function(target, options) {
      var fileInput = this._inputs.filter(function(input) {
        return !input.isStream;
      })[0];
      var self2 = this;
      this.ffprobe(this._inputs.indexOf(fileInput), function(err, data) {
        if (err) {
          return self2.emit("error", err);
        }
        var hasAudioStreams = data.streams.some(function(stream) {
          return stream.codec_type === "audio";
        });
        var hasVideoStreams = data.streams.some(function(stream) {
          return stream.codec_type === "video";
        });
        self2.output(target, options).complexFilter({
          filter: "concat",
          options: {
            n: self2._inputs.length,
            v: hasVideoStreams ? 1 : 0,
            a: hasAudioStreams ? 1 : 0
          }
        }).run();
      });
      return this;
    };
  };
  return recipes;
}
var path$1 = path$3;
var util = require$$2;
var EventEmitter = require$$0$2.EventEmitter;
var utils = utilsExports;
function FfmpegCommand(input, options) {
  if (!(this instanceof FfmpegCommand)) {
    return new FfmpegCommand(input, options);
  }
  EventEmitter.call(this);
  if (typeof input === "object" && !("readable" in input)) {
    options = input;
  } else {
    options = options || {};
    options.source = input;
  }
  this._inputs = [];
  if (options.source) {
    this.input(options.source);
  }
  this._outputs = [];
  this.output();
  var self2 = this;
  ["_global", "_complexFilters"].forEach(function(prop) {
    self2[prop] = utils.args();
  });
  options.stdoutLines = "stdoutLines" in options ? options.stdoutLines : 100;
  options.presets = options.presets || options.preset || path$1.join(import.meta.dirname, "presets");
  options.niceness = options.niceness || options.priority || 0;
  this.options = options;
  this.logger = options.logger || {
    debug: function() {
    },
    info: function() {
    },
    warn: function() {
    },
    error: function() {
    }
  };
}
util.inherits(FfmpegCommand, EventEmitter);
var fluentFfmpeg$1 = FfmpegCommand;
FfmpegCommand.prototype.clone = function() {
  var clone = new FfmpegCommand();
  var self2 = this;
  clone.options = this.options;
  clone.logger = this.logger;
  clone._inputs = this._inputs.map(function(input) {
    return {
      source: input.source,
      options: input.options.clone()
    };
  });
  if ("target" in this._outputs[0]) {
    clone._outputs = [];
    clone.output();
  } else {
    clone._outputs = [
      clone._currentOutput = {
        flags: {}
      }
    ];
    ["audio", "audioFilters", "video", "videoFilters", "sizeFilters", "options"].forEach(function(key) {
      clone._currentOutput[key] = self2._currentOutput[key].clone();
    });
    if (this._currentOutput.sizeData) {
      clone._currentOutput.sizeData = {};
      utils.copy(this._currentOutput.sizeData, clone._currentOutput.sizeData);
    }
    utils.copy(this._currentOutput.flags, clone._currentOutput.flags);
  }
  ["_global", "_complexFilters"].forEach(function(prop) {
    clone[prop] = self2[prop].clone();
  });
  return clone;
};
requireInputs()(FfmpegCommand.prototype);
requireAudio()(FfmpegCommand.prototype);
requireVideo()(FfmpegCommand.prototype);
requireVideosize()(FfmpegCommand.prototype);
requireOutput()(FfmpegCommand.prototype);
requireCustom()(FfmpegCommand.prototype);
requireMisc()(FfmpegCommand.prototype);
requireProcessor()(FfmpegCommand.prototype);
requireCapabilities()(FfmpegCommand.prototype);
FfmpegCommand.setFfmpegPath = function(path2) {
  new FfmpegCommand().setFfmpegPath(path2);
};
FfmpegCommand.setFfprobePath = function(path2) {
  new FfmpegCommand().setFfprobePath(path2);
};
FfmpegCommand.setFlvtoolPath = function(path2) {
  new FfmpegCommand().setFlvtoolPath(path2);
};
FfmpegCommand.availableFilters = FfmpegCommand.getAvailableFilters = function(callback) {
  new FfmpegCommand().availableFilters(callback);
};
FfmpegCommand.availableCodecs = FfmpegCommand.getAvailableCodecs = function(callback) {
  new FfmpegCommand().availableCodecs(callback);
};
FfmpegCommand.availableFormats = FfmpegCommand.getAvailableFormats = function(callback) {
  new FfmpegCommand().availableFormats(callback);
};
FfmpegCommand.availableEncoders = FfmpegCommand.getAvailableEncoders = function(callback) {
  new FfmpegCommand().availableEncoders(callback);
};
requireFfprobe()(FfmpegCommand.prototype);
FfmpegCommand.ffprobe = function(file) {
  var instance = new FfmpegCommand(file);
  instance.ffprobe.apply(instance, Array.prototype.slice.call(arguments, 1));
};
requireRecipes()(FfmpegCommand.prototype);
var fluentFfmpeg = fluentFfmpeg$1;
const ffmpeg = /* @__PURE__ */ getDefaultExportFromCjs(fluentFfmpeg);
var ffmpegStatic = { exports: {} };
const name = "ffmpeg-static";
const version = "5.3.0";
const description = "ffmpeg binaries for macOS, Linux and Windows";
const scripts = {
  install: "node install.js",
  prepublishOnly: "npm run install"
};
const repository = {
  type: "git",
  url: "https://github.com/eugeneware/ffmpeg-static"
};
const keywords = [
  "ffmpeg",
  "static",
  "binary",
  "binaries",
  "mac",
  "linux",
  "windows"
];
const authors = [
  "Eugene Ware <eugene@noblesamurai.com>",
  "Jannis R <mail@jannisr.de>"
];
const contributors = [
  "Thefrank (https://github.com/Thefrank)",
  "Emil Sivervik <emil@sivervik.com>"
];
const license = "GPL-3.0-or-later";
const bugs = {
  url: "https://github.com/eugeneware/ffmpeg-static/issues"
};
const engines = {
  node: ">=16"
};
const dependencies = {
  "@derhuerst/http-basic": "^8.2.0",
  "env-paths": "^2.2.0",
  "https-proxy-agent": "^5.0.0",
  progress: "^2.0.3"
};
const devDependencies = {
  "any-shell-escape": "^0.1.1"
};
const main = "index.js";
const files = [
  "index.js",
  "install.js",
  "example.js",
  "types"
];
const types = "types/index.d.ts";
const require$$0 = {
  name,
  version,
  description,
  scripts,
  "ffmpeg-static": {
    "binary-path-env-var": "FFMPEG_BIN",
    "binary-release-tag-env-var": "FFMPEG_BINARY_RELEASE",
    "binary-release-tag": "b6.1.1",
    "binaries-url-env-var": "FFMPEG_BINARIES_URL",
    "executable-base-name": "ffmpeg"
  },
  repository,
  keywords,
  authors,
  contributors,
  license,
  bugs,
  engines,
  dependencies,
  devDependencies,
  main,
  files,
  types
};
const pkg = require$$0;
const {
  "binary-path-env-var": BINARY_PATH_ENV_VAR,
  "executable-base-name": executableBaseName
} = pkg[pkg.name];
if (process.env[BINARY_PATH_ENV_VAR]) {
  ffmpegStatic.exports = process.env[BINARY_PATH_ENV_VAR];
} else {
  var os = require$$1;
  var path = path$3;
  var binaries = Object.assign(/* @__PURE__ */ Object.create(null), {
    darwin: ["x64", "arm64"],
    freebsd: ["x64"],
    linux: ["x64", "ia32", "arm64", "arm"],
    win32: ["x64", "ia32"]
  });
  var platform = process.env.npm_config_platform || os.platform();
  var arch = process.env.npm_config_arch || os.arch();
  let binaryPath = path.join(
    import.meta.dirname,
    executableBaseName + (platform === "win32" ? ".exe" : "")
  );
  if (!binaries[platform] || binaries[platform].indexOf(arch) === -1) {
    binaryPath = null;
  }
  ffmpegStatic.exports = binaryPath;
}
var ffmpegStaticExports = ffmpegStatic.exports;
const ffmpegPath = /* @__PURE__ */ getDefaultExportFromCjs(ffmpegStaticExports);
let writeStreams = {};
function setupRecorderHandlers() {
  ipcMain.handle("recorder:select-path", async () => {
    const { filePath } = await dialog.showSaveDialog({
      buttonLabel: "Save Video",
      defaultPath: `recording-${Date.now()}.webm`,
      filters: [{ name: "WebM Video", extensions: ["webm"] }]
    });
    return filePath;
  });
  ipcMain.handle("recorder:start-save", async (_, filePath) => {
    try {
      const stream = fs.createWriteStream(filePath);
      writeStreams[filePath] = stream;
      return { success: true };
    } catch (err) {
      console.error("Start Save Error:", err);
      return { success: false, error: err.message };
    }
  });
  ipcMain.handle("recorder:write-chunk", async (_, { filePath, chunk }) => {
    const stream = writeStreams[filePath];
    if (stream) {
      stream.write(Buffer.from(chunk));
      return { success: true };
    }
    return { success: false, error: "Stream not found" };
  });
  ipcMain.handle("recorder:stop-save", async (_, { filePath, userId, title, sourceUrl, saveToDb }) => {
    const stream = writeStreams[filePath];
    if (stream) {
      stream.end();
      delete writeStreams[filePath];
      if (saveToDb && userId) {
        try {
          const stmt = db.prepare("INSERT INTO fragments (user_id, title, source_url, file_path) VALUES (?, ?, ?, ?)");
          stmt.run(userId, title || "Untitled Recording", sourceUrl, filePath);
        } catch (dbErr) {
          console.error("DB Save Error:", dbErr);
        }
      }
      return { success: true };
    }
    return { success: false, error: "Stream not found" };
  });
  ipcMain.handle("recorder:get-sources", async () => {
    const { desktopCapturer } = await import("electron");
    const sources = await desktopCapturer.getSources({ types: ["window", "screen"] });
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL()
    }));
  });
  ipcMain.handle("recorder:get-temp-path", async () => {
    const tempPath = path$3.join(app.getPath("temp"), `recording-${Date.now()}.webm`);
    return tempPath;
  });
  ipcMain.handle("recorder:crop-video", async (_, { inputPath, crop }) => {
    if (ffmpegPath) {
      ffmpeg.setFfmpegPath(ffmpegPath);
    } else {
      console.error("FFmpeg path is null!");
      return { success: false, error: "FFmpeg binary not found" };
    }
    const outputPath = inputPath.replace(".webm", "-cropped.webm");
    return new Promise((resolve) => {
      const w = Math.floor(crop.width);
      const h = Math.floor(crop.height);
      const x = Math.floor(crop.x);
      const y = Math.floor(crop.y);
      console.log(`Starting FFmpeg crop: ${w}x${h} at ${x},${y}`);
      ffmpeg(inputPath).videoFilters(`crop=${w}:${h}:${x}:${y}`).output(outputPath).on("end", () => {
        console.log("FFmpeg crop finished:", outputPath);
        resolve({ success: true, outputPath });
      }).on("error", (err) => {
        console.error("FFmpeg Error:", err);
        resolve({ success: false, error: err.message });
      }).run();
    });
  });
  ipcMain.handle("recorder:delete-temp-file", async (_, filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
  ipcMain.handle("recorder:save-file", async (_, { tempPath, destination, userId, title, sourceUrl }) => {
    try {
      if (!fs.existsSync(tempPath)) {
        return { success: false, error: "Temp file not found" };
      }
      let finalPath = "";
      if (destination === "local") {
        const { filePath } = await dialog.showSaveDialog({
          buttonLabel: "Save Recording",
          defaultPath: `recording-${Date.now()}.webm`,
          filters: [{ name: "WebM Video", extensions: ["webm"] }]
        });
        if (!filePath) return { success: false, error: "Cancelled" };
        finalPath = filePath;
        fs.copyFileSync(tempPath, finalPath);
      } else if (destination === "drive") {
        return { success: true, filePath: tempPath };
      } else {
        const docsPath = app.getPath("documents");
        const recordingsDir = path$3.join(docsPath, "LicentaApp_Recordings");
        if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir);
        finalPath = path$3.join(recordingsDir, path$3.basename(tempPath));
        fs.copyFileSync(tempPath, finalPath);
      }
      if (finalPath && finalPath !== tempPath) {
        fs.unlinkSync(tempPath);
      }
      if (userId) {
        try {
          const stmt = db.prepare("INSERT INTO fragments (user_id, title, source_url, file_path) VALUES (?, ?, ?, ?)");
          stmt.run(userId, title || "Untitled Recording", sourceUrl || "", finalPath || tempPath);
        } catch (dbErr) {
          console.error("DB Insert Error:", dbErr);
        }
      }
      return { success: true, filePath: finalPath };
    } catch (err) {
      console.error("Save File Error:", err);
      return { success: false, error: err.message };
    }
  });
}
const CLIENT_ID = "YOUR_CLIENT_ID";
const CLIENT_SECRET = "YOUR_CLIENT_SECRET";
const REDIRECT_URI = "http://localhost:5000/callback";
let oAuth2Client = null;
let server = null;
let currentTokens = null;
function setupDriveHandlers() {
  ipcMain.handle("drive:get-session", async () => {
    return { isLoggedIn: !!currentTokens, user: null };
  });
  ipcMain.handle("drive:authenticate", async () => {
    return new Promise(async (resolve) => {
      const { OAuth2Client } = await import("./index-BSeJyK7v.js").then((n) => n.i);
      oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
      const authorizeUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: [
          "https://www.googleapis.com/auth/drive.file",
          "https://www.googleapis.com/auth/userinfo.profile",
          "https://www.googleapis.com/auth/userinfo.email"
        ]
      });
      if (server) {
        server.close();
        server = null;
      }
      server = http.createServer(async (req, res) => {
        try {
          if (req.url && req.url.startsWith("/callback")) {
            const qs = new url.URL(req.url, "http://localhost:5000").searchParams;
            const code = qs.get("code");
            if (code) {
              res.end("Authentication successful! You can close this window.");
              const { tokens } = await oAuth2Client.getToken(code);
              oAuth2Client.setCredentials(tokens);
              currentTokens = tokens;
              if (server) {
                server.close();
                server = null;
              }
              resolve({ success: true, tokens });
            } else {
              res.end("Authentication failed: No code received.");
              resolve({ success: false, error: "No code received" });
            }
          }
        } catch (e) {
          res.end("Authentication failed: " + e.message);
          resolve({ success: false, error: e.message });
        }
      });
      server.listen(5e3, () => {
        shell.openExternal(authorizeUrl);
      });
    });
  });
  ipcMain.handle("drive:logout", async () => {
    currentTokens = null;
    oAuth2Client = null;
    return { success: true };
  });
  ipcMain.handle("drive:upload", async (_, { filePath, tokens }) => {
    try {
      if (!tokens) {
        if (!currentTokens) throw new Error("No access tokens provided. Please login.");
        tokens = currentTokens;
      }
      if (!oAuth2Client) {
        const { OAuth2Client } = await import("./index-BSeJyK7v.js").then((n) => n.i);
        oAuth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
      }
      oAuth2Client.setCredentials(tokens);
      const { google } = await import("googleapis");
      const drive = google.drive({ version: "v3", auth: oAuth2Client });
      const response = await drive.files.create({
        requestBody: {
          name: path$3.basename(filePath),
          mimeType: "video/webm"
        },
        media: {
          mimeType: "video/webm",
          body: fs.createReadStream(filePath)
        },
        fields: "id, webViewLink, name"
      });
      return { success: true, fileId: response.data.id, link: response.data.webViewLink };
    } catch (error) {
      console.error("Upload error:", error);
      return { success: false, error: error.message || "Upload failed" };
    }
  });
}
setupAuthHandlers();
setupRecorderHandlers();
setupDriveHandlers();
const require$1 = createRequire(import.meta.url);
const __dirname$1 = path$4.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path$4.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path$4.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path$4.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path$4.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
function createWindow() {
  const appPath = app.getAppPath();
  const preloadPathRef = path$4.join(__dirname$1, "preload.cjs");
  const preloadPathRoot = path$4.join(appPath, "dist-electron", "preload.cjs");
  console.log("--- PATH DEBUGGING ---");
  console.log("App Path:", appPath);
  console.log("__dirname:", __dirname$1);
  console.log("Preload (ref):", preloadPathRef, "| Exists:", fs$1.existsSync(preloadPathRef));
  console.log("Preload (root):", preloadPathRoot, "| Exists:", fs$1.existsSync(preloadPathRoot));
  console.log("----------------------");
  const finalPreload = path$4.join(appPath, "dist-electron", "preload.cjs");
  const preloadExists = fs$1.existsSync(finalPreload);
  console.log("Final Preload Path used:", finalPreload, "| Exists:", preloadExists);
  win = new BrowserWindow({
    icon: path$4.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: finalPreload,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
      // Ensure web security is enabled
    }
  });
  win.webContents.on("preload-error", (event, preloadPath, error) => {
    console.error("!!! PRELOAD ERROR DETECTED !!!");
    console.error("Path:", preloadPath);
    console.error("Error:", error);
  });
  console.log("Final Preload Path used:", finalPreload);
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path$4.join(RENDERER_DIST, "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.disableHardwareAcceleration();
app.whenReady().then(() => {
  const { session } = require$1("electron");
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ["*://*.youtube.com/*", "*://*.googlevideo.com/*"] },
    (details, callback) => {
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    }
  );
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: *; media-src * blob:; frame-src *;"
        ]
      }
    });
  });
  createWindow();
});
export {
  MAIN_DIST as M,
  RENDERER_DIST as R,
  VITE_DEV_SERVER_URL as V,
  commonjsGlobal as c,
  getDefaultExportFromCjs as g
};
