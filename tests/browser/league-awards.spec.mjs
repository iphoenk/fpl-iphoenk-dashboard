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
