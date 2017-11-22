import React from 'react';
import { render } from 'react-dom';
import { AppContainer } from 'react-hot-loader';
import {Todo ,TodoList} from './AppState';
import TodoListView from './App';
import Provider from './common/Provider'

const store = new TodoList();
store.todos.push(
  new Todo("Get Coffee"),
  new Todo("Write simpler code")
);
store.todos[0].finished = true;

render(
  <AppContainer>
    <Provider color='res' name='hx'>
    <TodoListView todoList={store} />
    </Provider>
  </AppContainer>,
  document.getElementById('root')
);