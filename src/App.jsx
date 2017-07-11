import React, { Component } from 'react';
import { observer } from './common/observer.js';
@observer
class App extends Component {
  componentWillMount() {
    console.log('componentWillMount')
  }
  render() {
    return (
      <div>
        <button onClick={this.onReset}>
          Seconds passed: {this.props.appState.timer}
        </button>
      </div>
    );
  }

  onReset = () => {
    this.props.appState.resetTimer();
  }
};

// const App = observer(({ timerData }) =>
//   <span>Seconds passed: {timerData.secondsPassed} </span>
// );


// class App extends Component {
//   render() {
//     return (
//       <div>
//         <button >
//           {/*Seconds passed: {this.props.appState.timer}*/}
//           111
//         </button>
//         <DevTools />
//       </div>
//     );
//   }
// };

export default App;
