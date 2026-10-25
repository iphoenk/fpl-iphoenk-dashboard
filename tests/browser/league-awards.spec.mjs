import {test,expect} from '@playwright/test';
import {openOverview} from './harness.mjs';

async function openLeagueAwards(page,opts){
  await openOverview(page,{width:1024,...opts});
  await page.goto('/#liga');
  await page.waitForSelector('#leagueSelect');
  await page.selectOption('#leagueSelect','9477');
  await page.waitForSelector('#phaseThreeAwards .league-awards-grid',{timeout:45000});
}
const awardTitles=page=>page.locator('#phaseThreeAwards .league-award h3').allTextContents();

test('Awards cover the whole 58-team league, not the displayed page',async({page})=>{
  await openLeagueAwards(page);
  const note=page.locator('#phaseThreeAwards .strategy-note');
  await expect(note).toContainText('All 58 teams in the league.',{timeout:45000});
  await expect(note).not.toContainText('Partial');
  const titles=await awardTitles(page);
  for(const t of ['Top scorer','Tough week','Captain star','Armband miss','Overall rank riser','Overall rank faller','Chip performer','No-chip performer','Bench regret','Biggest hit','Value leader','Unique player haul'])expect(titles).toContain(t);
  // GW8 is not data_checked in the frozen bootstrap: nothing may be called final.
  await expect(note).toContainText('Provisional');
});

test('a failed standings page makes Awards partial, never a whole-league winner',async({page})=>{
  await openLeagueAwards(page,{mock:{failLeaguePage2:true}});
  const note=page.locator('#phaseThreeAwards .strategy-note');
  await expect(note).toContainText('Partial',{timeout:45000});
  await expect(note).toContainText('not league winners');
  await expect(page.locator('#phaseThreeAwards .league-award.unavailable h3')).toHaveText('Unique player haul');
});

test('the rank-history loading note clears even when league extras re-render mid-load (guard, not a proven repro of the old race)',async({page})=>{
  // Slow member histories so a second league render lands while they are in flight.
  await page.route('**/api/entry/*/history*',async route=>{await new Promise(r=>setTimeout(r,1200));await route.fallback();});
  await openLeagueAwards(page);
  await page.selectOption('#leagueSelect','');
  await page.selectOption('#leagueSelect','9477');
  await page.waitForSelector('#phaseThreeAwards .league-awards-grid',{timeout:45000});
  await expect(page.locator('#phaseThreeAwards .strategy-note')).not.toContainText('Loading rank history',{timeout:60000});
});

test('league pager does not present the 50 rows of one FPL page as the league total (58 teams, 2 pages)',async({page})=>{
  await openLeagueAwards(page);
  const label=page.locator('#leagueHeaderPage .compact-pagination span, #leaguePagination .compact-pagination span').first();
  await expect(label).toContainText('group 1');
  await expect(label).not.toContainText(/of 50/);
});
