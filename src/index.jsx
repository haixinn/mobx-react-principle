import React from 'react';
import { render } from 'react-dom';
import { AppContainer } from 'react-hot-loader';
import {Todo ,TodoList} from './AppState';
import TodoListView from './App';

const store = new TodoList();
store.todos.push(
  new Todo("Get Coffee"),
  new Todo("Write simpler code")
);
store.todos[0].finished = true;

render(
  <AppContainer>
    <TodoListView todoList={store} />
  </AppContainer>,
  document.getElementById('root')
);