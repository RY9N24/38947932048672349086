import {test} from 'node:test';
import assert from 'node:assert/strict';
import {plural} from './locale';
test('Russian plural handles 1, 2–4, teens, zero and large counts',()=>{for(const [n,word] of [[0,'задач'],[1,'задача'],[3,'задачи'],[5,'задач'],[11,'задач'],[14,'задач'],[21,'задача'],[112,'задач']] as const)assert.equal(plural(n,'задача','задачи','задач'),word);});
