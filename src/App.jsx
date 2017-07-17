import React, { Component } from 'react';
import { observer } from './common/observer.js';
import { observable } from 'mobx';

@observer
class App extends Component {

  componentWillMount() {
    console.log('componentWillMount')
  }

  componentDidMount() {
    console.log('did mount')
  }

  render() {
    console.log('render')
    return (
      <div>
        <button onClick={this.onReset}>
          Seconds passed:{this.props.appState.timer}
        </button>
      </div>
    );
  }

  // onReset = () => {
  //   this.timer = 1000
  // }
}

// const App = observer(() =>
//   <span>Seconds passed:2 </span>
// );


// class App extends Component {
//   componentWillMount() {
//     console.log('componentWillMount')
//   }

//   componentDidMount() {
//     console.log('did mount')
//   }
//   render() {
//     return (
//       <div>
//         <button >
//           {/*Seconds passed: {this.props.appState.timer}*/}
//           111
//         </button>
//       </div>
//     );
//   }
// };

export default App;
