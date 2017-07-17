import { Atom, Reaction, extras } from 'mobx';
import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import EventEmitter from './utils/EventEmitter';
import * as PropTypes from './propTypes';
import inject from './inject';


/**
 * Utilities
 */



function patch(target, funcName, runMixinFirst = false) {
  // 原始生命周期函数
  const base = target[funcName];
  // Mixin生命周期函数
  const mixinFunc = reactiveMixin[funcName];

  //如果没有覆盖
  const f = !base
    ? mixinFunc
    : runMixinFirst === true
      ? function () {
        //componentWillMount  
        //changelog 4.0.3  Fixed issue where userland componentWilMount was run before observer componentWillMount
        // twitter: From top of my head; otherwise props and state won't be observable in the userland cWM, as that was done only done afterwards
        mixinFunc.apply(this, arguments);
        base.apply(this, arguments);
      }
      : function () {
        base.apply(this, arguments);
        mixinFunc.apply(this, arguments);
      }
    ;
  // componentWillMount = () => {}

  target[funcName] = f;
  // if (!base) {
  //   target[funcName] = mixinFunc;
  // } else {
  //   target[funcName] = runMixinFirst === true
  //     ? function () {
  //       mixinFunc.apply(this, arguments);
  //       base.apply(this, arguments);
  //     }
  //     : function () {
  //       base.apply(this, arguments);
  //       mixinFunc.apply(this, arguments);
  //     }
  // }


  // MWE: ideally we freeze here to protect against accidental overwrites in component instances, see #195

  // ...but that breaks react-hot-loader, see #231...
}

function isObjectShallowModified(prev, next) {
  if (null == prev || null == next || typeof prev !== "object" || typeof next !== "object") {
    return prev !== next;
  }
  const keys = Object.keys(prev);
  if (keys.length !== Object.keys(next).length) {
    return true;
  }
  let key;
  for (let i = keys.length - 1; i >= 0, key = keys[i]; i--) {
    if (next[key] !== prev[key]) {
      return true;
    }
  }
  return false;
}

/**
 * ReactiveMixin
 */
const reactiveMixin = {
  componentWillMount: function () {
    // Generate friendly name for debugging

    //当前组件名
    const initialName = this.displayName
      || this.name
      || (this.constructor && (this.constructor.displayName || this.constructor.name))
      || "<component>";

    //当前节点id
    const rootNodeID = this._reactInternalInstance && this._reactInternalInstance._rootNodeID;

    /**
     * If props are shallowly modified, react will render anyway,
     * so atom.reportChanged() should not result in yet another re-render
     */
    let skipRender = false;
    /**
     * forceUpdate will re-assign this.props. We don't want that to cause a loop,
     * so detect these changes
     */
    let isForcingUpdate = false;

    function makePropertyObservableReference(propName) {

      let valueHolder = this[propName];
      // Atom 可以用来通知 Mobx 某些 observable 数据源被观察或发生了改变 当数据源被使用或不再使用时，MobX 会通知 atom
      // args 
      // 1. atom名字debugg 
      // 2. 当 atom 从未被观察到被观察时的回调函数
      // 3. 当 atom 从被观察到不再被观察时的回调函数
      const atom = new Atom("reactive " + propName);
      Object.defineProperty(this, propName, {
        configurable: true, enumerable: true,
        get: function () {
          //告诉mobx 已经被使用了
          atom.reportObserved();
          return valueHolder;
        },
        set: function set(v) {
          console.log('isForcingUpdate', isForcingUpdate)
          console.log(propName)
          if (!isForcingUpdate && isObjectShallowModified(valueHolder, v)) {
            valueHolder = v;
            skipRender = true;
            // 告诉mobx数据源发生了改变
            atom.reportChanged();
            skipRender = false;
          } else {
            valueHolder = v;
          }
        }
      })
    }

    // make this.props an observable reference, see #124
    makePropertyObservableReference.call(this, "props")
    // make state an observable reference
    makePropertyObservableReference.call(this, "state")

    // wire up reactive render
    //原始render
    const baseRender = this.render.bind(this);

    let reaction = null;

    //是否render中
    let isRenderingPending = false;

    //初始化render  
    const initialRender = () => {
      // observable属性发生改变就会触发 onInvalidate()  =>  forceupdate()
      reaction = new Reaction(`${initialName}#${rootNodeID}.render()`, () => {
        if (!isRenderingPending) {
          // N.B. Getting here *before mounting* means that a component constructor has side effects (see the relevant test in misc.js)
          // This unidiomatic React usage but React will correctly warn about this so we continue as usual
          // See #85 / Pull #44
          isRenderingPending = true;
          if (typeof this.componentWillReact === "function")
            this.componentWillReact(); // TODO: wrap in action?
          if (this.__$mobxIsUnmounted !== true) {
            // If we are unmounted at this point, componentWillReact() had a side effect causing the component to unmounted
            // TODO: remove this check? Then react will properly warn about the fact that this should not happen? See #73
            // However, people also claim this migth happen during unit tests..
            let hasError = true;
            try {
              isForcingUpdate = true;
              if (!skipRender)
                React.Component.prototype.forceUpdate.call(this);
              hasError = false;
              return;
            } finally {
              isForcingUpdate = false;
              if (hasError)
                reaction.dispose();
            }
          }
        }
      });
      reactiveRender.$mobx = reaction;
      // 以后都用reactiveRender
      this.render = reactiveRender;
      return reactiveRender();
    };

    const reactiveRender = () => {
      isRenderingPending = false;
      let exception = undefined;
      let rendering = undefined;
      console.log('track')
      reaction.track(() => {
        try {
          //弃用或重构在下一个版本,目前仅在@observer里使用
          rendering = extras.allowStateChanges(false, baseRender);
        } catch (e) {
          exception = e;
        }
      });
      if (exception) {
        errorsReporter.emit(exception);
        throw exception;
      }
      return rendering;
    };

    this.render = initialRender;
  },

  componentWillUnmount: function () {
    this.render.$mobx && this.render.$mobx.dispose();
    this.__$mobxIsUnmounted = true;
  },

  shouldComponentUpdate: function (nextProps, nextState) {

    // update on any state changes (as is the default)
    if (this.state !== nextState) {
      return true;
    }
    // 实现了一个牛逼的shouldComponentUpdate,不用你自己return false
    // update if props are shallowly not equal, inspired by PureRenderMixin
    // we could return just 'false' here, and avoid the `skipRender` checks etc
    // however, it is nicer if lifecycle events are triggered like usually,
    // so we return true here if props are shallowly modified.
    return isObjectShallowModified(this.props, nextProps);
  }
};

/**
 * Observer function / decorator
 */
export function observer(arg1, arg2) {
  const componentClass = arg1;

  // Stateless function component:
  // If it is function but doesn't seem to be a react class constructor,
  // wrap it to a react class automatically

  // console.log(componentClass)

  if (
    typeof componentClass === "function" &&
    (!componentClass.prototype || !componentClass.prototype.render) && !componentClass.isReactClass && !React.Component.isPrototypeOf(componentClass)
  ) {

    return observer(class extends Component {
      static displayName = componentClass.displayName || componentClass.name;
      static contextTypes = componentClass.contextTypes;
      static propTypes = componentClass.propTypes;
      static defaultProps = componentClass.defaultProps;
      render() {
        return componentClass.call(this, this.props, this.context);
      }
    });
  }

  // if (!componentClass) {
  //   throw new Error("Please pass a valid component to 'observer'");
  // }

  const target = componentClass.prototype || componentClass;

  //  reactiveMixin里生命周期函数放到react component
  mixinLifecycleEvents(target)
  componentClass.isMobXReactObserver = true;
  return componentClass;
}


function mixinLifecycleEvents(target) {
  patch(target, "componentWillMount", true);
  [
    "componentWillUnmount",
  ].forEach(function (funcName) {
    patch(target, funcName)
  });
  if (!target.shouldComponentUpdate) {
    target.shouldComponentUpdate = reactiveMixin.shouldComponentUpdate;
  }
}

// TODO: support injection somehow as well?
export const Observer = observer(
  ({ children }) => children()
)

Observer.propTypes = {
  children: (propValue, key, componentName, location, propFullName) => {
    if (typeof propValue[key] !== 'function')
      return new Error(
        'Invalid prop `' + propFullName + '` of type `' + typeof propValue[key] + '` supplied to' +
        ' `' + componentName + '`, expected `function`.'
      );
  }
}

// 1. mixinFunc this.render =  function initialRender()
// 2. this.initialRender => new Reaction (name:string,onInvalidate: () => void)
// Reactions: 应用状态的监听者 当依赖的应用状态发生变化时，能够自动地执行相应的动作。autorun、reaction、@observer都会创建
// 3. this.reactiveRender => reaction.track(fn) => trackDerivedFunction(derivation: reaction,render) 
// trackDerivedFunction: 会观察到所有observable的值,并且和reaction建立依赖关系
//  0).  每次runid都++
//  1).  执行 fn => baseRender => props ? atom.reportObserved()   告诉mobx有数据使用了 返回一个bool,如果是被观察的返回true 
//  2).  bindDependencies()  

//  observable属性修改时候会触发onInvalidate()  =>  forceupdate()
//  基本数据类型 ==> ObservableValue
//  Object ==> ObservableObject
//  Array ==> ObservableArray
//  Map ==> ObservableMap
// class ObservableValue {
//   get() {
//     this.reportObserved()   每个derivation有个唯一id,和之前最后一次id想不想等,如果相等依赖关系已经建立过了, 不相等添加观察的对象
//   }
//   set() {
//     this.reportChanged() => propagateChanged() => onBecomeStale() => this.schedule() => runReactions() =>runReactionsHelper() => runReaction() => this.onInvalidate();
//   }
// }
// Object.defineProperty(adm.target, propName, {
//   get: function() { return observable.get(); },
//   set: ...
// });
