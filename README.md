# SuperCheeseFork

![logo](logo.png)

A scheduling helper web application for Technion students, based on
[CheeseFork](https://github.com/michael-maltsev/cheese-fork) by Michael Maltsev,
with extra features for building and organizing your weekly schedule.

## What's new in SuperCheeseFork

### Custom events (blocks you add yourself)
- **Add event button** – the "הוספת אירוע" button in the top bar opens a dialog where
  you pick the day, start time and end time. You can still drag on the calendar
  instead; the times are pre-filled from what you dragged.
- **Color** – pick any color for a block, or go back to the automatic color.
- **Link to a course** – link a block to one of your courses (e.g. homework time
  for a course) and it gets the same color as that course.
- **Groups** – put blocks into named groups (e.g. "Gym", "Work"). Rename or delete
  a group from the sidebar; deleting a group keeps its blocks.
- **Filter** – the "אירועים מותאמים אישית" sidebar panel filters blocks by text
  and by group. Filtering only hides blocks, it never deletes them.

### Course averages panel
The "ממוצעים בסמסטר האחרון" sidebar panel lists every course in your schedule with
its final grade average (and Moed A/B averages) from the most recent semester
before the current one, using the shared
[technion-histograms](https://github.com/michael-maltsev/technion-histograms) data.

### Random schedule
The "מערכת אקראית" button picks a random group for every lesson type of your
selected courses. Each click gives a different schedule, and it:
- avoids overlaps between lessons and with your own blocks,
- avoids days with three back-to-back lectures of two hours or more,
- keeps lesson types you hid as hidden,
- tells you if a schedule without overlaps (or without back-to-back lectures)
  could not be found.

The result is saved like any other change, and "בטל שינויים" undoes it.

All the new data (block colors, groups and course links) is saved together with the
rest of your schedule.

### Differences from the original CheeseFork
- **No sign-in or schedule sharing.** The original app's sign-in uses its own
  Firebase project, so it is turned off here. Your schedule is saved in your browser
  (localStorage), which means it stays on the device and browser you used.
  iCalendar export still works and downloads the `.ics` file directly.
- **No analytics.** The original Google Analytics tracking is removed.

Course data and grade histograms are still loaded from the original CheeseFork
servers.

## Running locally

Requires Python 3 and an internet connection (course data is loaded online).

```bash
./run-local.sh
```

Then open http://localhost:4444. To use another port: `./run-local.sh 8080`.

## Credits and license

Based on [CheeseFork](https://github.com/michael-maltsev/cheese-fork) by
Michael Maltsev. Licensed under the GNU GPL v3 – see [LICENSE](LICENSE).
