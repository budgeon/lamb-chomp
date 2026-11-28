/**
 * Economy gate: simulates a typical player through the planned worlds and
 * checks the coin economy invariants (affordability, rewarded-hint ads only,
 * positive integer prices, unique ids). Pure: reads config, writes nothing.
 */
import { ECONOMY } from '../../src/economy/config';
import { checkEconomy, levelsToAfford, simulateEarnCurve } from '../../src/economy/check';

const errors = checkEconomy(ECONOMY);

if (errors.length === 0) {
  const curve = simulateEarnCurve(ECONOMY);
  const total = curve.length;
  console.log(
    `Earn curve: ${total} levels, worlds ${ECONOMY.simulation.worldSizes.join('/')}, ` +
      `star pattern ${ECONOMY.simulation.starPattern.join(',')}, ` +
      `badge pattern ${ECONOMY.simulation.badgePattern.map((b) => (b ? 'Y' : '-')).join(',')} ` +
      `(+${ECONOMY.earn.shepherdsBestBonus} per badge)`,
  );
  console.log('world  levels    coins at world end');
  let start = 1;
  ECONOMY.simulation.worldSizes.forEach((size, i) => {
    const end = start + size - 1;
    console.log(`${String(i + 1).padEnd(6)} ${`${start}-${end}`.padEnd(9)} ${curve[end - 1].coins}`);
    start = end + 1;
  });

  console.log('\ncosmetic           category    price  level');
  for (const item of [...ECONOMY.catalog].sort((a, b) => a.price - b.price)) {
    console.log(
      `${item.id.padEnd(18)} ${item.category.padEnd(11)} ${String(item.price).padStart(5)}  ${levelsToAfford(curve, item.price)}`,
    );
  }
  const catalogTotal = ECONOMY.catalog.reduce((s, c) => s + c.price, 0);
  const allAt = levelsToAfford(curve, catalogTotal);
  console.log(
    `\nWhole catalog: ${catalogTotal} coins vs ${curve[total - 1].coins} earned by level ${total}` +
      ` (${allAt ? `affordable at level ${allAt}` : 'not all affordable from play alone'}; informational)`,
  );
  console.log(`Ad placements: ${ECONOMY.ads.map((a) => `${a.id}=${a.kind}/${a.purpose}`).join(', ')}`);
  console.log('\neconomy gate: PASS');
} else {
  console.error('economy gate: FAIL');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
