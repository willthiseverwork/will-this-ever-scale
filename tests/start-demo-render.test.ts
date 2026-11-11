import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import StartDemoFindings from '../components/start-demo-findings';
import {analyze} from '../lib/engine';
import {leadSummary} from '../components/lead-card';
import {money} from '../lib/display';
import rows from './fixtures/demo-rows-chat.json';
import type {Txn} from '../lib/types';

test('start demo finding renders the lead calculated from the supplied shop, not a design literal',()=>{
 const shopRows=rows as Txn[]; const analysis=analyze(shopRows,{asOf:'2026-11-11T00:00:00Z'});
 const lead=analysis.ranked_leaks[0]; assert.equal(lead.id,'one_time_buyers');
 const summary=leadSummary(analysis,lead);
 const html=renderToStaticMarkup(React.createElement(StartDemoFindings,{analysis,rows:shopRows}));
 assert.ok(html.includes(`About +${money(summary.amount,analysis.currency)}`));
 assert.ok(html.includes(summary.condition.replace(/your /g,'its ')));
});
