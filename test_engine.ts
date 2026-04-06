import { createInitialState } from './src/state/gameLogic';
import * as Engine from './src/state/gameEngine';

let state = createInitialState();
console.log("INITIAL PHASE:", state.phase);
state = Engine.actionDraw(state);
console.log("AFTER DRAW PHASE:", state.phase);
console.log("P1 HAND:", state.players[0].hand);
state = Engine.actionRoll(state);
console.log("AFTER ROLL PHASE:", state.phase, "RESULT:", state.dieResult);
