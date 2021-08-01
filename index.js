/**
 * generator函数的自动执行器,会返回一个promise,使用如下
 * co(gen).then(function (){
 *    console.log('函数执行完成')
 * })
 * 
 * 原理:
 * 接受generator函数作为参数,返回一个promise对象
 * 然后将next()方法包装为一个新的promise,依次执行
 * onFulfilled方法获取当前generator执行状态的next执行结果
 * next方法对执行状态及next属性加以判断处理
 *    状态为done则执行resolve,如果为主promise,则resolve最外层的回调,否则onFulfilled
 *    未完成  执行co新建的子promise并将onFulfilled作为回调传入,执行完成,会回到主promise
 */

/**
 * slice() reference.
 */

//  保存slice方法，后面多次用到
var slice = Array.prototype.slice;

/**
 * Expose `co`.
 */

// 导出co
module.exports = co['default'] = co.co = co;

/**
 * Wrap the given generator `fn` into a
 * function that returns a promise.
 * This is a separate function so that
 * every `co()` call doesn't create a new,
 * unnecessary closure.
 *
 * @param {GeneratorFunction} fn
 * @return {Function}
 * @api public
 */

// 调用将 generator 方法包装为promise
co.wrap = function (fn) {
  createPromise.__generatorFunction__ = fn;
  return createPromise;
  function createPromise () {
    return co.call(this, fn.apply(this, arguments));
  }
};

/**
 * Execute the generator function or a generator
 * and return a promise.
 *
 * @param {Function} fn
 * @return {Promise}
 * @api public
 */

/**
 * 执行generator,返回一个promise对象
 * 首次调用即将整个fn包在主promise中
 */
function co (gen) {
  // 当前执行环境上下文
  var ctx = this;
  // 获取参数
  var args = slice.call(arguments, 1);

  // we wrap everything in a promise to avoid promise chaining,
  // which leads to memory leak errors.
  // see https://github.com/tj/co/issues/180
  return new Promise(function (resolve, reject) {
    //  如果是generatorFunction函数的话，就初始化generator函数
    if (typeof gen === 'function') gen = gen.apply(ctx, args);
    //  如果gen不存在,或者gen不是generator函数，则直接resovle将该值返回
    if (!gen || typeof gen.next !== 'function') return resolve(gen);
    //  初始化入口函数
    onFulfilled();

    /**
     * @param {Mixed} res
     * @return {Promise}
     * @api private
     */

    function onFulfilled (res) {
      var ret;
      try {
        //  拿到第一个yield返回的对象值保存到ret参数中
        ret = gen.next(res);
      } catch (e) {
        //  如果异常的话,则直接调用reject把promise设置为失败状态
        return reject(e);
      }
      //  然后继续把generator的指针指向下一个状态
      next(ret);
      return null;
    }

    /**
     * @param {Error} err
     * @return {Promise}
     * @api private
     */

    function onRejected (err) {
      var ret;
      try {
        //  抛出错误，使用generator对象throw. 在try catch里面可以捕获到该异常
        ret = gen.throw(err);
      } catch (e) {
        return reject(e);
      }
      //  调用实现自动执行的关键函数next,继续把generator的指针指向下一个状态
      next(ret);
    }

    /**
     * Get the next value in the generator,
     * return a promise.
     *
     * @param {Object} ret
     * @return {Promise}
     * @api private
     */

    /**
     * next函数的实现
     * 如果为done,则value传入resolve并执行,否则调用co生成子promise,继续执行
     */
    function next (ret) {
      //  如果generator函数执行完成后，该done会为true，因此直接调用resolve把promise设置为成功状态
      if (ret.done) return resolve(ret.value);
      //  把yield返回的值转换成promise
      var value = toPromise.call(ctx, ret.value);
      /**
       * 如果有返回值的话，且该返回值是一个promise对象的话，如果成功的话就会执行onFulfilled回调函数
       * 如果失败的话，就会调用 onRejected 回调函数
       */
      if (value && isPromise(value)) return value.then(onFulfilled, onRejected);
      //  否则的话，说明有异常，即调用 onRejected 函数给出错误提示
      return onRejected(new TypeError('You may only yield a function, promise, generator, array, or object, '
        + 'but the following object was passed: "' + String(ret.value) + '"'));
    }
  });
}

/**
 * Convert a `yield`ed value into a promise.
 *
 * @param {Mixed} obj
 * @return {Promise}
 * @api private
 */

/**
 * 将obj转换成promise
 * obj无非为以下几种类型
 * 1.非object的基本数据类型 ==> 直接返回
 * 2.promise ==> 直接返回
 * 3.generator对象和方法  ==> co调用
 * 4.thunk函数  ==> thunkToPromise
 * 5.Object ==> ObjectToPromise
 */
function toPromise (obj) {
  if (!obj) return obj;
  //  如果是promise,则直接返回
  if (isPromise(obj)) return obj;
  //  主要看这里,能转化为generator函数的最终都要再次调用co函数,生成子promise,这样就完成了循环调用
  if (isGeneratorFunction(obj) || isGenerator(obj)) return co.call(this, obj);
  //  如果为函数,则调用thunkToPromise转成promise
  if ('function' == typeof obj) return thunkToPromise.call(this, obj);
  //  如果为数组,则调用arrayToPromise转成promise
  if (Array.isArray(obj)) return arrayToPromise.call(this, obj);
  //  如果为对象,则调用objectToPromise转成promise
  if (isObject(obj)) return objectToPromise.call(this, obj);
  return obj;
}

/**
 * Convert a thunk to a promise.
 *
 * @param {Function}
 * @return {Promise}
 * @api private
 */

/**
 * thunk函数转成promise
 */
function thunkToPromise (fn) {
  var ctx = this;
  return new Promise(function (resolve, reject) {
    //  执行执行fn,回调函数中控制状态
    fn.call(ctx, function (err, res) {
      if (err) return reject(err);
      //  多余的参数作为res返回 resolve函数中
      if (arguments.length > 2) res = slice.call(arguments, 1);
      resolve(res);
    });
  });
}

/**
 * Convert an array of "yieldables" to a promise.
 * Uses `Promise.all()` internally.
 *
 * @param {Array} obj
 * @return {Promise}
 * @api private
 */

/**
 * map遍历array,把所有的item都转换为promise
 * 数组转换直接使用promise.all获取所有item resolve之后值的实例
 */
function arrayToPromise (obj) {
  return Promise.all(obj.map(toPromise, this));
}

/**
 * Convert an object of "yieldables" to a promise.
 * Uses `Promise.all()` internally.
 *
 * @param {Object} obj
 * @return {Promise}
 * @api private
 */

/**
 * 对象转换为promise
 * 对象属性可能是多种类型,所以利用Object.keys()对其属性进行遍历,转换为promise
 * 并push到数组汇总,然后将该数组转换为promise
 */
function objectToPromise (obj) {
  var results = new obj.constructor();
  //  获取属性数组,并根据其进行遍历
  var keys = Object.keys(obj);
  //  保存所有promise的数组
  var promises = [];
  for (var i = 0; i < keys.length; i++) {
    //  单个对象value
    var key = keys[i];
    //  转换为promise
    var promise = toPromise.call(this, obj[key]);
    //  转换指挥,push到promise数组
    if (promise && isPromise(promise)) defer(promise, key);
    //  非promise属性,直接赋值给results
    else results[key] = obj[key];
  }
  return Promise.all(promises).then(function () {
    return results;
  });
  /**
   * 给promise实例增加resolve方法并push到数组中
   * resolve方法就是给results对应的key赋值
   */
  function defer (promise, key) {
    // predefine the key in the result
    results[key] = undefined;
    promises.push(promise.then(function (res) {
      results[key] = res;
    }));
  }
}

/**
 * Check if `obj` is a promise.
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

/**
 * 判断是否为promise
 * 利用promise.then存在且为function
 */
function isPromise (obj) {
  return 'function' == typeof obj.then;
}

/**
 * Check if `obj` is a generator.
 *
 * @param {Mixed} obj
 * @return {Boolean}
 * @api private
 */

/**
 * 判断是否为generator
 * 利用generator的next和throw两属性均为function
 */
function isGenerator (obj) {
  return 'function' == typeof obj.next && 'function' == typeof obj.throw;
}

/**
 * Check if `obj` is a generator function.
 *
 * @param {Mixed} obj
 * @return {Boolean}
 * @api private
 */

/**
 * 判断是否为generator函数
 * 利用constructor === Object
 * var a = {}
 * a.constructor === Object
 * a.constructor.name //  "Object"
 */
function isGeneratorFunction (obj) {
  var constructor = obj.constructor;
  if (!constructor) return false;
  if ('GeneratorFunction' === constructor.name || 'GeneratorFunction' === constructor.displayName) return true;
  return isGenerator(constructor.prototype);
}

/**
 * Check for plain object.
 *
 * @param {Mixed} val
 * @return {Boolean}
 * @api private
 */

/**
 * 判断是否为干净对象
 * 利用constructor属性
 * Object.constructor === Object
 */
function isObject (val) {
  return Object == val.constructor;
}
