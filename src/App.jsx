import React, { Component } from 'react';
import { observer } from './common/observer.js';
import inject from './common/inject'

@inject('color','name')
@observer
class TodoListView extends Component {
  render() {
  console.log('render')
      return <div>
        <div>{this.props.color}</div>
        <div>{this.props.name}</div>
          <ul>
              {this.props.todoList.todos.map(todo => 
                  <TodoView todo={todo} key={todo.id} />
              )}
          </ul>
          Tasks left: {this.props.todoList.unfinishedTodoCount}
      </div>
  }
}


const TodoView = observer(({todo}) => 
  <li>
      <input
          type="checkbox"
          checked={todo.finished}
          onClick={() => todo.finished = !todo.finished}
      />{todo.title}
  </li>
);

export default TodoListView;
