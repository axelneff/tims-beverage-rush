const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const context = { console: console };
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(__dirname + '/recipes.js', 'utf8'), context);
vm.runInContext(fs.readFileSync(__dirname + '/game-rules.js', 'utf8'), context);
const TBR = context.TBR;

assert.strictEqual(TBR.RECIPES.length, 42);
assert.ok(!/build-cards|TimZone|pdf_page/.test(fs.readFileSync(__dirname + '/recipes.js', 'utf8')));

const starters = ['iced-capp', 'iced-coffee-double-double', 'caramel-iced-capp'];
starters.forEach((id) => assert.ok(TBR.exposable(TBR.byId[id]), id + ' should be servable'));
assert.ok(!TBR.exposable(TBR.byId['mocha-iced-capp']), 'uncertain mocha stays off the menu');
assert.ok(!TBR.exposable(TBR.byId['coffee']));
assert.ok(TBR.exposable(TBR.byId['iced-lemonade']));
assert.strictEqual(Array.from(TBR.tierExposable(0)).join(','), starters.join(','));
assert.strictEqual(Array.from(TBR.tierExposable(1)).join(','), 'iced-lemonade');

function hints(id, size, flavor) {
  return TBR.expandBuild(TBR.byId[id], size, { flavor: flavor }).map((step) => step.hint);
}
const same = (actual, expected) => assert.strictEqual(Array.from(actual).join('\n'), expected.join('\n'));

['Small', 'Medium', 'Large'].forEach((size) => {
  const oz = { Small: 12, Medium: 16, Large: 22 }[size];
  same(hints('iced-capp', size), [
    size + ' cup · ' + oz + ' oz',
    'Cream · 1st line',
    'Dome lid',
    'Java Mix · 4th line',
    'Whip 15 seconds',
    'Rinse the whipper',
    'Present to guest with a straw'
  ]);
  const pumps = { Small: 2, Medium: 3, Large: 4 }[size];
  same(hints('caramel-iced-capp', size), [
    size + ' cup · ' + oz + ' oz',
    'Cream · 1st line',
    'Caramel syrup · ' + pumps + ' pumps',
    'Dome lid',
    'Java Mix · 4th line',
    'Whip 15 seconds',
    'Rinse the whipper',
    'Add whipped topping',
    'Caramel drizzle',
    'Present to guest with a straw'
  ]);
});

function dd(size, flavor) {
  const oz = { Small: 16, Medium: 22, Large: 32 }[size];
  const fill = size === 'Large' ? '2nd' : '3rd';
  const flavorPumps = { Small: 3, Medium: 4, Large: 5 }[size];
  const steps = [
    size + ' cup · ' + oz + ' oz',
    'Cane sugar syrup · 2 pumps'
  ];
  if (flavor) steps.push('Flavored syrup · ' + flavorPumps + ' pumps');
  steps.push(
    'Cold dairy or dairy alternative',
    'Iced coffee · ' + fill + ' line',
    'Stir',
    'Fill cup with ice',
    'Strawless lid',
    'Hand off to the guest'
  );
  same(hints('iced-coffee-double-double', size, flavor), steps);
}
['Small', 'Medium', 'Large'].forEach((size) => {
  dd(size, false);
  dd(size, true);
});

function assertChoices(id, size, flavor) {
  const steps = TBR.expandBuild(TBR.byId[id], size, { flavor: flavor });
  steps.forEach((step) => {
    if (step.kind === 'simple') {
      assert.strictEqual(TBR.choiceOk(step, null), true);
      return;
    }
    const choices = TBR.choicesFor(step);
    const correct = TBR.correctChoiceId(step);
    assert.ok(choices.some((choice) => choice.id === correct), correct + ' missing for ' + step.hint);
    assert.strictEqual(TBR.choiceOk(step, correct), true);
    const wrong = choices.filter((choice) => choice.id !== correct)[0];
    if (wrong) assert.strictEqual(TBR.choiceOk(step, wrong.id), false);
  });
}
starters.forEach((id) => {
  ['Small', 'Medium', 'Large'].forEach((size) => {
    assertChoices(id, size, false);
    assertChoices(id, size, true);
  });
});
assertChoices('iced-lemonade', 'Large', false);
assert.strictEqual(
  TBR.correctChoiceId(TBR.expandBuild(TBR.byId['iced-lemonade'], 'Large')[1]),
  'fill:Lemonade:2nd'
);
assert.strictEqual(
  TBR.correctChoiceId(TBR.expandBuild(TBR.byId['iced-lemonade'], 'Medium')[1]),
  'fill:Lemonade:3rd'
);

const dropped = TBR.dropStage({ mastery: 45, mastered: false });
assert.strictEqual(dropped.mastery, 39);
assert.strictEqual(TBR.hintStage(dropped.mastery), 1);
const fromTop = TBR.dropStage({ mastery: 80, mastered: true });
assert.strictEqual(fromTop.mastery, 79);
assert.strictEqual(fromTop.mastered, false);
assert.strictEqual(TBR.hintStage(0), 0);
assert.strictEqual(TBR.hintStage(20), 1);
assert.strictEqual(TBR.hintStage(40), 2);
assert.strictEqual(TBR.hintStage(60), 3);
assert.strictEqual(TBR.hintStage(80), 4);

const earned = TBR.grantMastery({ mastery: 70, mastered: false }, { clean: true, inTime: true, hintsOff: true });
assert.strictEqual(earned.mastery, 92);
assert.strictEqual(earned.mastered, true);
assert.strictEqual(earned.reviewEvery, 3);
const again = TBR.grantMastery(earned, { clean: true, inTime: true, hintsOff: true });
assert.strictEqual(again.reviewEvery, 8);

const progress = { unlockedThrough: 0, seen: 0, drinks: {} };
TBR.ensureRecords(progress);
progress.drinks['iced-capp'].mastery = 60;
progress.drinks['iced-coffee-double-double'].mastery = 60;
progress.drinks['caramel-iced-capp'].mastery = 60;
assert.ok(TBR.tierAverage(progress, 0) >= 60);
assert.strictEqual(TBR.peekUnlock(progress), 1);

const iced = TBR.byId['iced-capp'];
const dbl = TBR.byId['iced-coffee-double-double'];
assert.ok(TBR.weightFor(dbl, { mastery: 0 }) > TBR.weightFor(iced, { mastery: 0 }));
assert.ok(TBR.largeFillDiffers(dbl));
assert.ok(!TBR.largeFillDiffers(iced));

const view0 = TBR.ticketView({ steps: TBR.expandBuild(iced, 'Medium') }, 0);
assert.ok(view0.glow);
assert.ok(view0.lines.length > 3);
assert.strictEqual(view0.lines[1], '2. Cream · 1st line');
const view1 = TBR.ticketView({ steps: TBR.expandBuild(iced, 'Medium') }, 25);
assert.strictEqual(Array.from(view1.lines).join('|'), 'Follow the glowing station');
assert.strictEqual(view1.glow, true);
const view2 = TBR.ticketView({ steps: TBR.expandBuild(iced, 'Medium') }, 45);
assert.strictEqual(view2.glow, false);
assert.ok(view2.icons.length > 3);
const view3 = TBR.ticketView({ steps: TBR.expandBuild(iced, 'Medium') }, 65);
assert.strictEqual(view3.lines.length, 1);
assert.ok(String(view3.lines[0]).indexOf('Medium cup') !== -1);
const view4 = TBR.ticketView({ steps: TBR.expandBuild(iced, 'Medium') }, 90);
assert.strictEqual(Array.from(view4.lines).join('|'), 'You know this one');
assert.strictEqual(view4.icons.length, 0);

let seq = [0.01, 0, 0, 1];
progress.drinks['iced-capp'].mastery = 100;
progress.drinks['iced-capp'].mastered = true;
progress.drinks['iced-capp'].ordersUntilReview = 0;
const review = TBR.pickOrder(progress, () => seq.shift());
assert.strictEqual(review.id, 'iced-capp');

const late = TBR.scoreFor(true, false);
assert.strictEqual(late.perfect, false);
assert.ok(late.points < TBR.scoreFor(true, true).points);

console.log('rules ok', TBR.exposedIds(0).join(', '));
console.log('tier2', TBR.tierExposable(1).join(', '));
console.log('tier3', TBR.tierExposable(2).join(', '));
