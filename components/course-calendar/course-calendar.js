'use strict';

/* global moment, BootstrapDialog, gtag */

// eslint-disable-next-line no-unused-vars
var CourseCalendar = (function () {
    function CourseCalendar(element, options) {
        this.element = element;
        this.courseManager = options.courseManager;
        this.colorGenerator = options.colorGenerator;
        this.readonly = options.readonly;
        this.onCourseHoverIn = options.onCourseHoverIn;
        this.onCourseHoverOut = options.onCourseHoverOut;
        this.onCourseConflictedStatusChanged = options.onCourseConflictedStatusChanged;
        this.onLessonTypesHidden = options.onLessonTypesHidden;
        this.onLessonSelected = options.onLessonSelected;
        this.onLessonUnselected = options.onLessonUnselected;
        this.onCustomEventAdded = options.onCustomEventAdded;
        this.onCustomEventUpdated = options.onCustomEventUpdated;
        this.onCustomEventRemoved = options.onCustomEventRemoved;
        this.customEventFilter = {text: '', group: null};

        var that = this;

        element.addClass('course-calendar').fullCalendar({
            defaultDate: '2017-01-01',
            //editable: true,
            //eventLimit: true, // allow "more" link when too many events
            defaultView: 'agendaWeek',
            header: false,
            allDaySlot: false,
            minTime: '08:30:00',
            maxTime: '18:30:00',
            height: 'auto',
            contentHeight: 'auto',
            columnFormat: 'dddd',
            locale: 'he',
            slotEventOverlap: false,
            displayEventTime: false,
            selectable: !that.readonly,
            selectHelper: true,
            selectOverlap: true,
            select: onSelect.bind(that),
            eventRender: onEventRender.bind(that),
            eventDrop: onCustomEventMoveResize.bind(that),
            eventResize: onCustomEventMoveResize.bind(that),
            eventClick: onEventClick.bind(that),
            eventMouseover: onEventMouseover.bind(that),
            eventMouseout: onEventMouseout.bind(that),
            eventAfterRender: afterEventRender.bind(that),
            windowResize: onWindowResize.bind(that)
        }).fullCalendar('option', {
            // Set afterwards as a bug workaround.
            // https://github.com/fullcalendar/fullcalendar/issues/4102
            hiddenDays: [5, 6]
        });

        element.on('mouseleave', function () {
            updateCalendarMaxDayAndTime(element, true);
        });

        initTouchScalingSupport(that);

        updateDynamicSizes(that);
    }

    function initTouchScalingSupport(courseCalendar) {
        var calendar = courseCalendar.element;

        // Based on the CSS rule:
        // .fc-time-grid .fc-slats td {
        //     height: 1.5em;
        // }
        var gridSlotHeight = 1.5;

        var scaling = false;
        var verticalCenter;
        var pendingAnimationRequest = null;
        var renderRequired = false;
        var previousDist;

        // Based on:
        // https://stackoverflow.com/a/11183333

        calendar.get(0).addEventListener('touchstart', function (event) {
            // https://plus.google.com/+RickByers/posts/GHwpqnAFATf
            event.target.addEventListener('touchmove', onTouchMove, {passive: true});
            event.target.addEventListener('touchend', onTouchEnd, {passive: true});
            event.target.addEventListener('touchcancel', onTouchEnd, {passive: true});

            if (!scaling && event.touches.length >= 2) {
                scaling = true;
                verticalCenter = getVerticalCenter(event.touches);
                previousDist = Math.hypot(
                    event.touches[0].pageX - event.touches[1].pageX,
                    event.touches[0].pageY - event.touches[1].pageY);

                pendingAnimationRequest = window.requestAnimationFrame(renderNewSlotHeight);
            } else if (scaling && event.touches.length < 2) {
                scaling = false;
                endScaling();
            }
        }, {passive: true});

        function onTouchMove(event) {
            if (scaling && event.touches.length >= 2) {
                var dist = Math.hypot(
                    event.touches[0].pageX - event.touches[1].pageX,
                    event.touches[0].pageY - event.touches[1].pageY);
                scaleGridSlotHeight(dist / previousDist);
                previousDist = dist;
            }
        }

        function onTouchEnd(event) {
            if (scaling) {
                if (event.type === 'touchcancel' || event.touches.length < 2) {
                    scaling = false;
                    endScaling();
                }
            }

            var targetStillTouched = false;
            for (var i = 0; i < event.touches.length; i++) {
                var touch = event.touches[i];
                if (touch.target === event.target) {
                    targetStillTouched = true;
                    break;
                }
            }

            if (!targetStillTouched) {
                event.target.removeEventListener('touchmove', onTouchMove);
                event.target.removeEventListener('touchend', onTouchEnd);
                event.target.removeEventListener('touchcancel', onTouchEnd);
            }
        }

        function endScaling() {
            if (pendingAnimationRequest !== null) {
                window.cancelAnimationFrame(pendingAnimationRequest);
                renderNewSlotHeight();
            }
        }

        function scaleGridSlotHeight(scale) {
            var prevHeight = gridSlotHeight;
            gridSlotHeight *= scale;
            if (gridSlotHeight < 1.5) {
                gridSlotHeight = 1.5;
            } else if (gridSlotHeight > 4.5) {
                gridSlotHeight = 4.5;
            }

            if (gridSlotHeight !== prevHeight) {
                renderRequired = true;
            }
        }

        function renderNewSlotHeight() {
            if (renderRequired) {
                var timeGrid = calendar.find('.fc-time-grid');
                var heightBefore = timeGrid.height();

                calendar.find('.fc-time-grid .fc-slats td').css('height', gridSlotHeight + 'em');

                calendar.fullCalendar('render');
                calendar.fullCalendar('rerenderEvents');

                var heightAfter = timeGrid.height();

                // Make verticalCenter the vertical anchor of the zoom.
                $(window).scrollTop($(window).scrollTop() + (heightAfter - heightBefore) * verticalCenter);

                renderRequired = false;
            }

            if (scaling) {
                pendingAnimationRequest = window.requestAnimationFrame(renderNewSlotHeight);
            } else {
                pendingAnimationRequest = null;
            }
        }

        function getVerticalCenter(touches) {
            var timeGrid = calendar.find('.fc-time-grid');
            var offset = timeGrid.offset();
            var top = offset.top;
            var height = timeGrid.height();

            var centerY = (touches[0].pageY + touches[1].pageY) / 2;

            var centerYRelative = (centerY - top) / height;
            if (centerYRelative < 0) {
                centerYRelative = 0;
            } else if (centerYRelative > 1) {
                centerYRelative = 1;
            }

            return centerYRelative;
        }
    }

    function updateDynamicSizes(courseCalendar) {
        var calendar = courseCalendar.element;

        // This is an ugly hack. FullCalendar calculates the positions of event
        // elements dynamically, but the print layout doesn't interpret the css
        // font-size rules correctly, so the elements are rendered in the wrong
        // positions. This workaround creates a print-only stylesheet with the
        // calculated sizes. Note that it assumes that there's only one calendar
        // element on the page.
        var css = '';

        var el1 = $('.fc-time-grid .fc-slats td', calendar)[0];
        if (el1) {
            var fontSize1 = window.getComputedStyle(el1).getPropertyValue('font-size');
            css += '.course-calendar .fc-time-grid .fc-slats td { font-size: ' + fontSize1 + '; }';
        }

        var el2 = $('.fc-event', calendar)[0];
        if (el2) {
            var fontSize2 = window.getComputedStyle(el2).getPropertyValue('font-size');
            css += '.course-calendar .fc-event { font-size: ' + fontSize2 + '; }';
        } else {
            courseCalendar.printStyleHackWaitingForEvent = true;
        }

        if (css) {
            css = '@media print { ' + css + ' }';

            var styleElement = courseCalendar.printStyleHackStyleElement;
            if (!styleElement) {
                styleElement = document.createElement('style');
                document.head.appendChild(styleElement);
                courseCalendar.printStyleHackStyleElement = styleElement;
            }

            styleElement.textContent = css;
        }
    }

    function stringHexEncode(str) {
        var result = '';
        for (var i = 0; i < str.length; i++) {
            var hex = str.charCodeAt(i).toString(16);
            result += ('000' + hex).slice(-4);
        }
        return result;
    }

    function getLessonType(courseNumber, lesson) {
        // Sport courses have a non-standard format, treat all of the lessons as the same type.
        if (/^(394[89]\d\d|03940[89]\d\d)$/.test(courseNumber)) {
            return 'sport';
        } else {
            return stringHexEncode(lesson['סוג']);
        }
    }

    function getEventLessonType(event) {
        return getLessonType(event.courseNumber, event.lessonData);
    }

    function updateLessonEvents(calendar, events) {
        events = events.slice(); // make a copy
        events.forEach(function (value, index) {
            events[index] = $.extend({}, events[index]); // make a copy

            // Delete properties which are not shared among events with the same id.
            delete events[index].title;
            delete events[index].lessonData;
        });
        calendar.fullCalendar('updateEvents', events);
    }

    function updateLessonEvent(calendar, event) {
        updateLessonEvents(calendar, [event]);
    }

    function getCourseConflictedStatus(calendar, course) {
        var lessonTypesAvailable = {};
        var lessonTypesVisible = {};

        calendar.fullCalendar('clientEvents', function (event) {
            if (event.courseNumber !== course || event.lessonTypeHidden) {
                return false;
            }

            var type = getLessonType(course, event.lessonData);
            lessonTypesAvailable[type] = true;
            if (event.start.week() === 1) {
                lessonTypesVisible[type] = true;
            }

            return false;
        });

        return Object.keys(lessonTypesAvailable).some(function (type) {
            return !lessonTypesVisible[type];
        });
    }

    function getCourseHiddenLessonTypes(calendar, course, courseManager) {
        var lessonTypesHidden = {};

        calendar.fullCalendar('clientEvents', function (event) {
            if (event.courseNumber !== course || !event.lessonTypeHidden) {
                return false;
            }

            var lesson = event.lessonData;
            var lessonType = courseManager.getLessonType(lesson);
            lessonTypesHidden[lessonType] = true;

            return false;
        });

        return Object.keys(lessonTypesHidden);
    }

    function updateCalendarMaxDayAndTime(calendar, ignoreHover) {
        var minTime = calendar.fullCalendar('getCalendar').moment('2017-01-01T08:30:00');
        var maxTime = calendar.fullCalendar('getCalendar').moment('2017-01-01T18:30:00');
        var maxDay = 4;

        calendar.fullCalendar('clientEvents', function (event) {
            // Only displayed events determine the visible range.
            if (event.start.week() !== 1) {
                return false;
            }

            // Subtract one minute to treat 24:00 as the previous day.
            var endDay = event.end.clone().add(-1, 'minute').day();
            if (maxDay < endDay) {
                maxDay = endDay;
            }

            var start = event.start.clone().set({year: 2017, month: 0, date: 1});
            var end = event.end.clone().set({year: 2017, month: 0, date: 1});

            if (event.end.day() !== event.start.day()) {
                // Event spans to more than one day, display up to 24:00 to make sure it's visible.
                end = calendar.fullCalendar('getCalendar').moment('2017-01-01T24:00:00');
            }

            if (minTime.isAfter(start)) {
                minTime = start;
            }

            if (maxTime.isBefore(end)) {
                maxTime = end;
            }

            return false;
        });

        // Round to the nearest half hour.
        if (minTime.minute() >= 30) {
            minTime.set({minute: 30, second: 0, millisecond: 0});
        } else {
            minTime.set({minute: 0, second: 0, millisecond: 0});
        }

        if (maxTime.hour() === 0) {
            maxTime.set({minute: 0, second: 0, millisecond: 0});
        } else if (maxTime.minute() > 30) {
            maxTime.set({hour: maxTime.hour() + 1, minute: 0, second: 0, millisecond: 0});
        } else if (maxTime.minute() > 0) {
            maxTime.set({minute: 30, second: 0, millisecond: 0});
        } else {
            maxTime.set({minute: 0, second: 0, millisecond: 0});
        }

        minTime = minTime.format('HH:mm:ss');
        maxTime = maxTime.format('kk:mm:ss');
        var hiddenDays = [];
        for (var i = maxDay + 1; i < 7; i++) {
            hiddenDays.push(i);
        }

        var currentMinTime = calendar.fullCalendar('option', 'minTime');
        var currentMaxTime = calendar.fullCalendar('option', 'maxTime');
        var currentHiddenDays = calendar.fullCalendar('option', 'hiddenDays');

        // Shrinking the range shifts the layout under the pointer, wait until it leaves.
        if (!ignoreHover && calendar.is(':hover')) {
            if (minTime > currentMinTime) {
                minTime = currentMinTime;
            }

            if (maxTime < currentMaxTime) {
                maxTime = currentMaxTime;
            }

            if (hiddenDays.length > currentHiddenDays.length) {
                hiddenDays = currentHiddenDays;
            }
        }

        // Only apply options that changed, avoids re-rendering if not needed, which is very slow.
        var newOptions = {};

        if (minTime !== currentMinTime) {
            newOptions.minTime = minTime;
        }

        if (maxTime !== currentMaxTime) {
            newOptions.maxTime = maxTime;
        }

        if (JSON.stringify(hiddenDays) !== JSON.stringify(currentHiddenDays)) {
            newOptions.hiddenDays = hiddenDays;
        }

        if (Object.keys(newOptions).length > 0) {
            calendar.fullCalendar('option', newOptions);
        }
    }

    function areEventsOverlapping(event1, event2) {
        if (event1.start.day() !== event2.start.day()) {
            return false;
        }

        var startTime1 = event1.start.clone().year(0).month(0).date(1);
        var endTime1 = event1.end.clone().year(0).month(0).date(1);
        var startTime2 = event2.start.clone().year(0).month(0).date(1);
        var endTime2 = event2.end.clone().year(0).month(0).date(1);

        return startTime1.isBefore(endTime2) && endTime1.isAfter(startTime2);
    }

    function makeLessonEvent(courseCalendar, course, lesson) {
        var lessonType = getLessonType(course, lesson);
        var lessonStartEnd = courseCalendar.courseManager.parseLessonTime(lesson['שעה']);

        var dayMapping = {
            'ראשון': 1,
            'שני': 2,
            'שלישי': 3,
            'רביעי': 4,
            'חמישי': 5,
            'שישי': 6,
            'א': 1,
            'ב': 2,
            'ג': 3,
            'ד': 4,
            'ה': 5,
            'ו': 6
        };

        var lessonStartDay = dayMapping[lesson['יום']];
        var lessonEndDay = lessonStartDay;
        if (lessonStartEnd.end === '00:00') {
            lessonEndDay++;
        }

        var eventStartEnd = {
            start: courseCalendar.element.fullCalendar('getCalendar').moment('2017-01-0' + lessonStartDay + 'T' + lessonStartEnd.start + ':00'),
            end: courseCalendar.element.fullCalendar('getCalendar').moment('2017-01-0' + lessonEndDay + 'T' + lessonStartEnd.end + ':00')
        };

        var eventId = course + '.' + lesson['מס.'] + '.' + lessonType;

        var general = courseCalendar.courseManager.getGeneralInfo(course);

        var title = courseCalendar.courseManager.getLessonTypeAndNumber(lesson);
        if (lesson['בניין']) {
            title += '\n' + lesson['בניין'];
            if (lesson['חדר']) {
                title += ' ' + lesson['חדר'];
            }
        }
        if (lesson['מרצה/מתרגל']) {
            var staffLines = lesson['מרצה/מתרגל'].split('\n');
            if (staffLines.length > 3) {
                var staffLinesCount = staffLines.length;
                staffLines = staffLines.slice(0, 2);
                staffLines.push('ועוד ' + (staffLinesCount - 2) + ' אחרים');
            }

            title += '\n' + staffLines.join('\n');
        }
        title += '\n' + general['שם מקצוע'];

        return {
            id: eventId,
            title: title,
            start: eventStartEnd.start,
            end: eventStartEnd.end,
            backgroundColor: courseCalendar.colorGenerator(course),
            textColor: 'white',
            borderColor: 'white',
            className: 'calendar-item-course-' + course +
                ' calendar-item-course-' + course + '-type-' + lessonType +
                ' calendar-item-course-' + course + '-lesson-' + lesson['מס.'],
            courseNumber: course,
            lessonData: lesson,
            selected: false,
            temporary: false
        };
    }

    function initCreateCourseEvents(courseCalendar, course) {
        var schedule = courseCalendar.courseManager.getSchedule(course);
        if (schedule.length === 0) {
            return [];
        }

        var lessonsAdded = {};
        var events = [];

        for (var i = 0; i < schedule.length; i++) {
            var lesson = schedule[i];
            if (lessonsAdded[lesson['מס.']] && lessonsAdded[lesson['מס.']] !== lesson['קבוצה']) {
                continue;
            }

            events.push(makeLessonEvent(courseCalendar, course, lesson));
            lessonsAdded[lesson['מס.']] = lesson['קבוצה'];
        }

        return events;
    }

    function initSelectLesson(events, courseNumber, lessonType, lessonNumber) {
        var selected = false;
        var conflictedIds = {};

        if (lessonNumber !== '-') {
            events.forEach(function (cbEvent) {
                if (cbEvent.start.week() === 1 &&
                    !cbEvent.selected &&
                    cbEvent.courseNumber === courseNumber &&
                    getEventLessonType(cbEvent) === lessonType &&
                    cbEvent.lessonData['מס.'] === lessonNumber) {

                    cbEvent.selected = true;
                    selected = true;

                    markConflictedEvents(cbEvent);
                }
            });
        } else {
            selected = true;
        }

        if (selected) {
            events.forEach(function (cbEvent) {
                if (cbEvent.courseNumber === courseNumber &&
                    getEventLessonType(cbEvent) === lessonType &&
                    cbEvent.lessonData['מס.'] !== lessonNumber) {
                    // Different lesson number of the same course and type - can no longer be selected.
                    cbEvent.start.add(7, 'days');
                    cbEvent.end.add(7, 'days');

                    if (lessonNumber === '-') {
                        cbEvent.lessonTypeHidden = true;
                    }
                }

                if (conflictedIds[cbEvent.id]) {
                    var weeks = conflictedIds[cbEvent.id];
                    cbEvent.start.add(7 * weeks, 'days');
                    cbEvent.end.add(7 * weeks, 'days');
                }
            });
        }

        function markConflictedEvents(event) {
            events.forEach(function (cbEvent) {
                if (cbEvent.courseNumber === event.courseNumber &&
                    getEventLessonType(cbEvent) === getEventLessonType(event)) {
                    return;
                }

                if (areEventsOverlapping(cbEvent, event)) {
                    if (!conflictedIds[cbEvent.id]) {
                        conflictedIds[cbEvent.id] = 0;
                    }
                    conflictedIds[cbEvent.id]++;
                }
            });
        }
    }

    function getCustomEventAutoColor(courseCalendar, eventTitle, course) {
        // A block linked to a course gets the same color as the course.
        return courseCalendar.colorGenerator(course || eventTitle);
    }

    function makeCustomEvent(courseCalendar, eventId, eventTitle, start, end, color, group, course) {
        return {
            id: eventId,
            className: 'custom-event',
            title: eventTitle,
            start: start,
            end: end,
            customColor: color || null,
            customGroup: group || null,
            customCourse: course || null,
            backgroundColor: color || getCustomEventAutoColor(courseCalendar, eventTitle, course),
            textColor: 'white',
            borderColor: 'white',
            editable: !courseCalendar.readonly,
            constraint: {
                start: '2017-01-01T00:00:00',
                end: '2017-01-07T24:00:00'
            },
            courseNumber: null,
            lessonData: null,
            selected: true,
            temporary: false
        };
    }

    function getCustomEventData(event) {
        var eventData = {
            title: event.title,
            start: event.start.format(),
            end: event.end.format()
        };
        if (event.customColor) {
            eventData.color = event.customColor;
        }
        if (event.customGroup) {
            eventData.group = event.customGroup;
        }
        if (event.customCourse) {
            eventData.course = event.customCourse;
        }
        return eventData;
    }

    function getCustomEvents(calendar) {
        return calendar.fullCalendar('clientEvents', function (event) {
            return event.courseNumber === null;
        });
    }

    function getCustomEventGroups(calendar) {
        var groups = {};
        getCustomEvents(calendar).forEach(function (event) {
            if (event.customGroup) {
                groups[event.customGroup] = true;
            }
        });
        return Object.keys(groups).sort();
    }

    function getCourseTitleSafe(courseManager, course) {
        return courseManager.doesExist(course) ? courseManager.getTitle(course) : course;
    }

    function getScheduleCourses(calendar) {
        var courses = {};
        calendar.fullCalendar('clientEvents', function (event) {
            if (event.courseNumber !== null && !event.temporary) {
                courses[event.courseNumber] = true;
            }
            return false;
        });
        return Object.keys(courses);
    }

    function makeCustomEventForm(courseCalendar, title, color, group, course) {
        var form = $('<div class="custom-event-form">' +
            '<textarea class="form-control custom-event-form-title" placeholder="תיאור האירוע"></textarea>' +
            '<div class="form-row mt-2">' +
            '<div class="col-auto">' +
            '<label class="small mb-0 d-block">צבע</label>' +
            '<div class="d-flex align-items-center">' +
            '<input type="color" class="custom-event-form-color">' +
            '<button type="button" class="btn btn-sm btn-link custom-event-form-color-reset">אוטומטי</button>' +
            '</div>' +
            '</div>' +
            '<div class="col">' +
            '<label class="small mb-0 d-block">קבוצה</label>' +
            '<input type="text" class="form-control form-control-sm custom-event-form-group" placeholder="ללא קבוצה">' +
            '<datalist></datalist>' +
            '</div>' +
            '</div>' +
            '<div class="mt-2">' +
            '<label class="small mb-0 d-block">שיוך לקורס (הבלוק יקבל את צבע הקורס)</label>' +
            '<select class="form-control form-control-sm custom-event-form-course">' +
            '<option value="">ללא קורס</option>' +
            '</select>' +
            '</div>' +
            '</div>');

        var courseSelect = form.find('.custom-event-form-course');
        var courses = getScheduleCourses(courseCalendar.element);
        if (course && courses.indexOf(course) === -1) {
            courses.push(course);
        }
        courses.forEach(function (courseNumber) {
            courseSelect.append($('<option>').attr('value', courseNumber)
                .text(getCourseTitleSafe(courseCalendar.courseManager, courseNumber)));
        });
        courseSelect.val(course || '');

        var datalistId = 'custom-event-groups-' + Date.now();
        var datalist = form.find('datalist').attr('id', datalistId);
        getCustomEventGroups(courseCalendar.element).forEach(function (groupName) {
            datalist.append($('<option>').attr('value', groupName));
        });

        var colorInput = form.find('.custom-event-form-color');
        var titleInput = form.find('.custom-event-form-title').val(title || '');
        form.find('.custom-event-form-group').attr('list', datalistId).val(group || '');

        function updateAutoColor() {
            if (!colorInput.data('custom')) {
                var autoColor = getCustomEventAutoColor(courseCalendar, titleInput.val().trim(), courseSelect.val());
                colorInput.val(autoColor);
            }
        }

        colorInput.data('custom', !!color);
        if (color) {
            colorInput.val(color);
        } else {
            updateAutoColor();
        }

        colorInput.on('input change', function () {
            colorInput.data('custom', true);
        });
        titleInput.on('input', updateAutoColor);
        courseSelect.on('change', function () {
            // Picking a course switches the block to the course color.
            colorInput.data('custom', false);
            updateAutoColor();
        });
        form.find('.custom-event-form-color-reset').on('click', function () {
            colorInput.data('custom', false);
            updateAutoColor();
        });

        return form;
    }

    function readCustomEventForm(form) {
        var colorInput = form.find('.custom-event-form-color');
        return {
            title: form.find('.custom-event-form-title').val().trim(),
            color: colorInput.data('custom') ? colorInput.val() : null,
            group: form.find('.custom-event-form-group').val().trim() || null,
            course: form.find('.custom-event-form-course').val() || null
        };
    }

    function customEventMatchesFilter(event, filter) {
        if (filter.group !== null) {
            if (filter.group === '') {
                if (event.customGroup) {
                    return false;
                }
            } else if (event.customGroup !== filter.group) {
                return false;
            }
        }

        if (filter.text !== '' && event.title.toLowerCase().indexOf(filter.text.toLowerCase()) === -1) {
            return false;
        }

        return true;
    }

    function onEventRender(event, element) {
        if (event.courseNumber !== null) {
            return;
        }

        if (!customEventMatchesFilter(event, this.customEventFilter)) {
            return false;
        }

        var tooltip = [];
        if (event.customCourse) {
            tooltip.push('קורס: ' + getCourseTitleSafe(this.courseManager, event.customCourse));
        }
        if (event.customGroup) {
            tooltip.push('קבוצה: ' + event.customGroup);
        }
        if (tooltip.length > 0) {
            element.attr('title', tooltip.join('\n'));
        }
    }

    var customEventDayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

    function makeCustomEventTimeFields(day, startTime, endTime) {
        var fields = $('<div class="form-row mt-2 custom-event-form-time">' +
            '<div class="col">' +
            '<label class="small mb-0 d-block">יום</label>' +
            '<select class="form-control form-control-sm custom-event-form-day"></select>' +
            '</div>' +
            '<div class="col">' +
            '<label class="small mb-0 d-block">משעה</label>' +
            '<input type="time" step="300" class="form-control form-control-sm custom-event-form-start">' +
            '</div>' +
            '<div class="col">' +
            '<label class="small mb-0 d-block">עד שעה</label>' +
            '<input type="time" step="300" class="form-control form-control-sm custom-event-form-end">' +
            '</div>' +
            '<div class="col-12 small text-danger custom-event-form-time-error"></div>' +
            '</div>');

        var daySelect = fields.find('.custom-event-form-day');
        customEventDayNames.forEach(function (dayName, i) {
            daySelect.append($('<option>').attr('value', i).text(dayName));
        });
        daySelect.val(day);
        fields.find('.custom-event-form-start').val(startTime);
        fields.find('.custom-event-form-end').val(endTime);

        return fields;
    }

    function parseTimeInput(value) {
        var match = /^(\d{1,2}):(\d{2})/.exec(value.trim());
        if (!match) {
            return null;
        }
        var hours = parseInt(match[1], 10);
        var minutes = parseInt(match[2], 10);
        if (hours > 24 || minutes > 59 || (hours === 24 && minutes > 0)) {
            return null;
        }
        return {hour: hours, minute: minutes};
    }

    // Returns {start, end} moments, or a string with an error message.
    function readCustomEventTimeFields(courseCalendar, form) {
        var day = parseInt(form.find('.custom-event-form-day').val(), 10);
        var startTime = parseTimeInput(form.find('.custom-event-form-start').val());
        var endTime = parseTimeInput(form.find('.custom-event-form-end').val());
        if (!startTime || !endTime) {
            return 'יש להזין שעת התחלה ושעת סיום';
        }

        var calendarMoment = courseCalendar.element.fullCalendar('getCalendar');
        var dayDate = calendarMoment.moment('2017-01-01T00:00:00').add(day, 'days');
        var start = dayDate.clone().add(startTime.hour, 'hours').add(startTime.minute, 'minutes');
        var end = dayDate.clone().add(endTime.hour, 'hours').add(endTime.minute, 'minutes');
        if (!end.isAfter(start)) {
            return 'שעת הסיום חייבת להיות אחרי שעת ההתחלה';
        }

        return {start: start, end: end};
    }

    // Shows the dialog for adding a custom event. If start and end are given
    // (e.g. from selecting a range in the calendar), the day and time fields are
    // pre-filled with them.
    function showAddCustomEventDialog(courseCalendar, start, end) {
        var that = courseCalendar;
        var calendar = that.element;

        var form = makeCustomEventForm(that);
        if (start && end) {
            form.find('.custom-event-form-title').after(makeCustomEventTimeFields(
                start.day(), start.format('HH:mm'), end.format('kk:mm')));
        } else {
            form.find('.custom-event-form-title').after(makeCustomEventTimeFields(0, '10:30', '12:30'));
        }

        BootstrapDialog.show({
            title: 'הוספת אירוע מותאם אישית',
            message: form,
            onshown: function (dialog) {
                dialog.getModalBody().find('textarea').focus();
            },
            onhide: function (dialog) {
                calendar.fullCalendar('unselect');
            },
            buttons: [{
                label: 'הוסף',
                cssClass: 'btn-primary',
                action: function (dialog) {
                    var body = dialog.getModalBody();
                    var times = readCustomEventTimeFields(that, body);
                    if (typeof times === 'string') {
                        body.find('.custom-event-form-time-error').text(times);
                        return;
                    }

                    dialog.close();

                    var formData = readCustomEventForm(body);
                    var eventTitle = formData.title;
                    if (eventTitle === '') {
                        return;
                    }

                    var eventIdCounter = Math.round(Date.now() / 1000);
                    var eventId = 'custom_event_' + eventIdCounter;
                    while (calendar.fullCalendar('clientEvents', eventId).length > 0) {
                        eventIdCounter++;
                        eventId = 'custom_event_' + eventIdCounter;
                    }

                    var newEvent = makeCustomEvent(that, eventId, eventTitle, times.start, times.end, formData.color, formData.group, formData.course);
                    calendar.fullCalendar('renderEvent', newEvent);
                    updateCalendarMaxDayAndTime(calendar);

                    that.onCustomEventAdded(eventIdCounter, getCustomEventData(newEvent));
                }
            }]
        });
    }

    function onSelect(start, end) {
        showAddCustomEventDialog(this, start, end);
    }

    function onCustomEventMoveResize(event) {
        var that = this;
        var calendar = that.element;

        updateCalendarMaxDayAndTime(calendar);

        that.onCustomEventUpdated(event.id.replace(/^custom_event_/, ''), getCustomEventData(event));
    }

    function onEventClick(event, jsEvent) {
        if (this.readonly) {
            return;
        }

        var that = this;
        var calendar = that.element;

        // The ':hover' check is for mobile, otherwise clicking on an event
        // can trigger the hide button even though it wasn't visible when clicking.
        if ($(jsEvent.target).hasClass('calendar-item-unselected-hide-button') && $(jsEvent.target).is(':hover')) {
            gtag('event', 'calendar-hide-click');

            var courseTitle = that.courseManager.getTitle(event.courseNumber);
            var lesson = event.lessonData;
            var lessonType = that.courseManager.getLessonType(lesson);

            var title = 'הסתרת אירועים מסוג ' + lessonType;
            var message = 'הפעולה תסתיר אירועים מסוג ' + lessonType + ' עבור הקורס ' + courseTitle + '. ' +
                'ניתן לבטל את ההסתרה על ידי ביטול בחירת הקורס ובחירתו מחדש.';

            BootstrapDialog.show({
                title: title,
                message: message,
                buttons: [{
                    label: 'הסתר',
                    cssClass: 'btn-primary',
                    action: function (dialog) {
                        gtag('event', 'calendar-hide-proceed');

                        dialog.close();

                        var targetLessonTypeEvents = calendar.fullCalendar('clientEvents', function (cbEvent) {
                            return cbEvent.courseNumber === event.courseNumber &&
                                getEventLessonType(cbEvent) === getEventLessonType(event);
                        });

                        targetLessonTypeEvents.forEach(function (cbEvent) {
                            cbEvent.start.add(7, 'days');
                            cbEvent.end.add(7, 'days');
                            cbEvent.lessonTypeHidden = true;
                        });

                        updateLessonEvents(calendar, targetLessonTypeEvents);
                        updateCalendarMaxDayAndTime(calendar);

                        that.onLessonSelected(event.courseNumber, '-', getEventLessonType(event));

                        var lessonTypesHidden = getCourseHiddenLessonTypes(calendar, event.courseNumber, that.courseManager);
                        that.onLessonTypesHidden(event.courseNumber, lessonTypesHidden);
                    }
                }, {
                    label: 'סגור',
                    action: function (dialog) {
                        dialog.close();
                    }
                }]
            });

            return;
        }

        if (event.courseNumber === null) {
            BootstrapDialog.show({
                title: 'עריכת אירוע מותאם אישית',
                message: makeCustomEventForm(that, event.title, event.customColor, event.customGroup, event.customCourse),
                onshown: function (dialog) {
                    dialog.getModalBody().find('textarea').focus();
                },
                buttons: [{
                    label: 'ערוך',
                    cssClass: 'btn-primary',
                    action: function (dialog) {
                        dialog.close();

                        var formData = readCustomEventForm(dialog.getModalBody());
                        var eventTitle = formData.title;
                        if (eventTitle === '') {
                            return;
                        }

                        event.title = eventTitle;
                        event.customColor = formData.color;
                        event.customGroup = formData.group;
                        event.customCourse = formData.course;
                        event.backgroundColor = formData.color || getCustomEventAutoColor(that, eventTitle, formData.course);
                        calendar.fullCalendar('updateEvent', event);

                        that.onCustomEventUpdated(event.id.replace(/^custom_event_/, ''), getCustomEventData(event));
                    }
                }, {
                    label: 'הסר',
                    action: function (dialog) {
                        dialog.close();

                        calendar.fullCalendar('removeEvents', event.id);
                        updateCalendarMaxDayAndTime(calendar);

                        that.onCustomEventRemoved(event.id.replace(/^custom_event_/, ''));
                    }
                }]
            });

            return;
        }

        var selectingEvent = !event.selected;
        var conflictedCourses = {};

        event.selected = selectingEvent;
        updateLessonEvent(calendar, event);

        var sameLessonTypeEvents = calendar.fullCalendar('clientEvents', function (cbEvent) {
            if (cbEvent.courseNumber === event.courseNumber &&
                getEventLessonType(cbEvent) === getEventLessonType(event)) {

                if (cbEvent.lessonData['מס.'] === event.lessonData['מס.']) {
                    // There might be multiple events for the same course, type, and number, process them all.
                    handleConflictedEvents(cbEvent);
                    return false;
                } else {
                    // Different lesson number of the same course and type - can no longer be selected.
                    return true;
                }
            }
            return false;
        });

        sameLessonTypeEvents.forEach(function (cbEvent) {
            cbEvent.start.add(selectingEvent ? 7 : -7, 'days');
            cbEvent.end.add(selectingEvent ? 7 : -7, 'days');
        });

        updateLessonEvents(calendar, sameLessonTypeEvents);
        updateCalendarMaxDayAndTime(calendar);

        Object.keys(conflictedCourses).forEach(function (conflictedCourse) {
            var conflicted = getCourseConflictedStatus(calendar, conflictedCourse);
            that.onCourseConflictedStatusChanged(conflictedCourse, conflicted);
        });

        if (selectingEvent) {
            that.onLessonSelected(event.courseNumber, event.lessonData['מס.'], getEventLessonType(event));
        } else {
            that.onLessonUnselected(event.courseNumber, event.lessonData['מס.'], getEventLessonType(event));
        }

        function handleConflictedEvents(event) {
            var conflictedIds = {};

            var conflictedEvents = calendar.fullCalendar('clientEvents', function (cbEvent) {
                if (cbEvent.courseNumber === null) {
                    return false;
                }

                if (cbEvent.courseNumber === event.courseNumber &&
                    getEventLessonType(cbEvent) === getEventLessonType(event)) {
                    return false;
                }

                if (areEventsOverlapping(cbEvent, event)) {
                    if (!conflictedIds[cbEvent.id]) {
                        conflictedIds[cbEvent.id] = 1;
                        return true;
                    }
                    conflictedIds[cbEvent.id]++;
                    return false;
                }

                return false;
            });

            for (var i = 0; i < conflictedEvents.length; i++) {
                var weeks = conflictedIds[conflictedEvents[i].id];
                conflictedEvents[i].start.add((selectingEvent ? 7 : -7) * weeks, 'days');
                conflictedEvents[i].end.add((selectingEvent ? 7 : -7) * weeks, 'days');
                conflictedCourses[conflictedEvents[i].courseNumber] = true;
            }

            updateLessonEvents(calendar, conflictedEvents);
        }
    }

    function onEventMouseover(event) {
        if (event.courseNumber === null) {
            return;
        }

        $('.calendar-item-course-' + event.courseNumber, this.element).addClass('calendar-item-same-course-as-hovered');
        $('.calendar-item-course-' + event.courseNumber + '-type-' + getEventLessonType(event), this.element).addClass('calendar-item-same-type-as-hovered');
        this.onCourseHoverIn(event.courseNumber);
    }

    function onEventMouseout(event) {
        if (event.courseNumber === null) {
            return;
        }

        $('.calendar-item-course-' + event.courseNumber, this.element).removeClass('calendar-item-same-course-as-hovered');
        $('.calendar-item-course-' + event.courseNumber + '-type-' + getEventLessonType(event), this.element).removeClass('calendar-item-same-type-as-hovered');
        this.onCourseHoverOut(event.courseNumber);
    }

    function afterEventRender(event, element) {
        var that = this;

        if (that.printStyleHackWaitingForEvent) {
            updateDynamicSizes(that);
            that.printStyleHackWaitingForEvent = false;
        }

        if (event.selected) {
            element.addClass('calendar-item-selected');
        } else {
            element.addClass('calendar-item-unselected');

            if (event.courseNumber !== null) {
                var sameType = $('.calendar-item-course-' + event.courseNumber + '-type-' + getEventLessonType(event), this.element)
                    .not('.calendar-item-course-' + event.courseNumber + '-lesson-' + event.lessonData['מס.']);
                if (sameType.length === 0) {
                    element.addClass('calendar-item-last-choice');
                }

                if (!this.readonly && !event.temporary) {
                    element.append('<div class="calendar-item-unselected-hide-button">הסתר</div>');
                }
            }
        }
    }

    function onWindowResize() {
        var that = this;

        updateDynamicSizes(that);
    }

    CourseCalendar.prototype.addCourse = function (course) {
        var that = this;

        var schedule = that.courseManager.getSchedule(course);
        if (schedule.length === 0) {
            return;
        }

        var calendar = that.element;

        var lessonsAdded = {};
        var events = [];
        var conflictedIds = {};

        for (var i = 0; i < schedule.length; i++) {
            var lesson = schedule[i];
            if (lessonsAdded[lesson['מס.']] && lessonsAdded[lesson['מס.']] !== lesson['קבוצה']) {
                continue;
            }

            var event = makeLessonEvent(that, course, lesson);

            var conflictCount = countEventConflicts(event);
            if (conflictCount > 0) {
                if (!conflictedIds[event.id]) {
                    conflictedIds[event.id] = 0;
                }
                conflictedIds[event.id] += conflictCount;
            }

            events.push(event);

            lessonsAdded[lesson['מס.']] = lesson['קבוצה'];
        }

        for (i = 0; i < events.length; i++) {
            if (conflictedIds[events[i].id]) {
                var weeks = conflictedIds[events[i].id];
                events[i].start.add(7 * weeks, 'days');
                events[i].end.add(7 * weeks, 'days');
            }
        }

        calendar.fullCalendar('renderEvents', events);

        if (Object.keys(conflictedIds).length > 0 && getCourseConflictedStatus(calendar, course)) {
            that.onCourseConflictedStatusChanged(course, true);
        }

        updateCalendarMaxDayAndTime(calendar);

        function countEventConflicts(event) {
            var count = 0;
            calendar.fullCalendar('clientEvents', function (cbEvent) {
                if (cbEvent.courseNumber !== null && cbEvent.selected && areEventsOverlapping(cbEvent, event)) {
                    count++;
                }
                return false;
            });
            return count;
        }
    };

    CourseCalendar.prototype.removeCourse = function (course) {
        var that = this;
        var calendar = that.element;

        // Show conflicting events which can now be selected.
        var conflictedIds = {};

        var conflictedEvents = calendar.fullCalendar('clientEvents', function (event) {
            if (event.courseNumber !== null && event.courseNumber !== course && isConflicted(event, course)) {
                if (!conflictedIds[event.id]) {
                    conflictedIds[event.id] = 1;
                    return true;
                }
                conflictedIds[event.id]++;
                return false;
            }

            return false;
        });

        var conflictedCourses = {};

        for (var i = 0; i < conflictedEvents.length; i++) {
            var weeks = conflictedIds[conflictedEvents[i].id];
            conflictedEvents[i].start.add(-7 * weeks, 'days');
            conflictedEvents[i].end.add(-7 * weeks, 'days');
            conflictedCourses[conflictedEvents[i].courseNumber] = true;
        }

        updateLessonEvents(calendar, conflictedEvents);
        calendar.fullCalendar('removeEvents', function (event) {
            return event.courseNumber === course;
        });

        Object.keys(conflictedCourses).forEach(function (conflictedCourse) {
            var conflicted = getCourseConflictedStatus(calendar, conflictedCourse);
            that.onCourseConflictedStatusChanged(conflictedCourse, conflicted);
        });

        updateCalendarMaxDayAndTime(calendar);

        // True if the event cannot be selected because of the given course.
        function isConflicted(event, course) {
            var conflictingEvent = calendar.fullCalendar('clientEvents', function (cbEvent) {
                return cbEvent.courseNumber === course && cbEvent.selected && areEventsOverlapping(cbEvent, event);
            });

            return conflictingEvent.length > 0;
        }
    };

    CourseCalendar.prototype.previewCourse = function (course) {
        var that = this;
        var calendar = that.element;

        var conflictedEvents = calendar.fullCalendar('clientEvents', function (event) {
            return event.courseNumber === course && event.start.week() > 1;
        });

        var temporaryEvents = [];

        for (var i = 0; i < conflictedEvents.length; i++) {
            var conf = conflictedEvents[i];
            var temp = {
                id: 'temp_' + conf.id,
                title: conf.title,
                start: conf.start.clone().week(1),
                end: conf.end.clone().week(1),
                backgroundColor: conf.backgroundColor,
                textColor: conf.textColor,
                borderColor: conf.borderColor,
                className: conf.className,
                courseNumber: conf.courseNumber,
                lessonData: conf.lessonData,
                selected: conf.selected,
                temporary: true
            };

            temporaryEvents.push(temp);
        }

        calendar.fullCalendar('renderEvents', temporaryEvents);

        $('.calendar-item-course-' + course, this.element).addClass('calendar-item-previewed');

        if (conflictedEvents.length > 0) {
            updateCalendarMaxDayAndTime(calendar);
        }
    };

    CourseCalendar.prototype.unpreviewCourse = function (course) {
        var that = this;
        var calendar = that.element;

        var removed = 0;

        calendar.fullCalendar('removeEvents', function (event) {
            if (event.temporary && event.courseNumber === course) {
                removed++;
                return true;
            } else {
                return false;
            }
        });

        $('.calendar-item-course-' + course, this.element).removeClass('calendar-item-previewed');

        if (removed > 0) {
            updateCalendarMaxDayAndTime(calendar);
        }
    };

    CourseCalendar.prototype.loadSavedSchedule = function (schedule, customEvents) {
        var that = this;
        var calendar = that.element;

        calendar.fullCalendar('removeEvents');

        var events = [];
        Object.keys(schedule).forEach(function (course) {
            events = events.concat(initCreateCourseEvents(that, course));
        });

        Object.keys(schedule).forEach(function (course) {
            var lessons = schedule[course];
            Object.keys(lessons).forEach(function (lessonType) {
                var lessonNumber = lessons[lessonType];
                initSelectLesson(events, course, lessonType, lessonNumber);
            });
        });

        Object.keys(customEvents).forEach(function (eventId) {
            var eventData = customEvents[eventId];
            var start = calendar.fullCalendar('getCalendar').moment(eventData.start);
            var end = calendar.fullCalendar('getCalendar').moment(eventData.end);
            events.push(makeCustomEvent(that, 'custom_event_' + eventId, eventData.title, start, end, eventData.color, eventData.group, eventData.course));
        });

        calendar.fullCalendar('renderEvents', events);
        updateCalendarMaxDayAndTime(calendar);

        Object.keys(schedule).forEach(function (course) {
            if (getCourseConflictedStatus(calendar, course)) {
                that.onCourseConflictedStatusChanged(course, true);
            }

            var lessonTypesHidden = getCourseHiddenLessonTypes(calendar, course, that.courseManager);
            if (lessonTypesHidden.length > 0) {
                that.onLessonTypesHidden(course, lessonTypesHidden);
            }
        });
    };

    CourseCalendar.prototype.saveAsIcs = function (icsCal, dateFrom, dateTo, daysOff) {
        var that = this;
        var calendar = that.element;

        var dateFromArray = dateFrom.split('-');
        var dateFromObject = {
            year: parseInt(dateFromArray[0], 10),
            month: parseInt(dateFromArray[1], 10) - 1,
            date: parseInt(dateFromArray[2], 10)
        };

        var until = moment.utc(dateTo + 'T00:00:00').add(1, 'days').format();
        var rrule = {freq: 'WEEKLY', until: until};

        // Pre-group days off by day of week (0=Sunday, 6=Saturday).
        var daysOffByDay = {};
        if (daysOff) {
            daysOff.forEach(function (dateStr) {
                var parts = dateStr.split('-');
                var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                var day = d.getDay();
                if (!daysOffByDay[day]) {
                    daysOffByDay[day] = [];
                }
                daysOffByDay[day].push(d);
            });
        }

        var count = 0;

        calendar.fullCalendar('clientEvents', function (event) {
            if (event.start.week() === 1 && event.selected) {
                var subject = '';
                var description = '';
                var location = '';
                if (event.courseNumber !== null) {
                    var general = that.courseManager.getGeneralInfo(event.courseNumber);
                    var lesson = event.lessonData;

                    subject = that.courseManager.getLessonTypeAndNumber(lesson);
                    subject += ' - ' + general['שם מקצוע'];

                    description = '';
                    if (lesson['מרצה/מתרגל']) {
                        description = lesson['מרצה/מתרגל'];
                    }

                    location = '';
                    if (lesson['בניין']) {
                        location = lesson['בניין'];
                        if (lesson['חדר']) {
                            location += ' ' + lesson['חדר'];
                        }
                    }
                } else {
                    subject = event.title.replace(/\n/g, ', ');
                }

                var begin = event.start.clone().set(dateFromObject);
                var eventDay = event.start.day();

                // If setting the day will move us to the past, add 7 days
                // to move forward to the next week.
                if (eventDay < begin.day()) {
                    begin.add(7, 'days');
                }

                begin.day(eventDay);
                var end = event.end.clone().add(begin.diff(event.start), 'milliseconds');

                // https://stackoverflow.com/a/667274
                description = description.replace(/\n/g, '\\n');

                // Causes timezone to be added to the formatted string,
                // fixes a time shift issue in Safari.
                // https://stackoverflow.com/q/54210749
                begin.local();
                end.local();

                icsCal.addEvent(subject, description, location, begin.format(), end.format(), rrule, daysOffByDay[eventDay]);
                count++;
            }

            return false;
        });

        return count;
    };

    function shuffleArray(array) {
        for (var i = array.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var temp = array[i];
            array[i] = array[j];
            array[j] = temp;
        }
        return array;
    }

    // Converts an event to a plain time interval, which is much faster to work
    // with than moment objects when checking many schedules.
    function eventToInterval(event) {
        var start = event.start.hours() * 60 + event.start.minutes();
        var end = event.end.hours() * 60 + event.end.minutes();
        if (event.end.day() !== event.start.day()) {
            end = 24 * 60;
        }
        return {
            day: event.start.day(),
            start: start,
            end: end,
            // A lecture of at least two hours.
            longLecture: event.lessonData !== null && event.lessonData['סוג'] === 'הרצאה' && end - start >= 120
        };
    }

    function countIntervalOverlaps(intervals, otherIntervals) {
        var count = 0;
        for (var i = 0; i < intervals.length; i++) {
            for (var j = 0; j < otherIntervals.length; j++) {
                var a = intervals[i];
                var b = otherIntervals[j];
                if (a.day === b.day && a.start < b.end && a.end > b.start) {
                    count++;
                }
            }
        }
        return count;
    }

    // Counts the days on which there are three (or more) lectures of at least two
    // hours each, back to back (each one starts when the previous one ends).
    function countBackToBackLectureTriples(intervals) {
        var lecturesByDay = {};
        intervals.forEach(function (interval) {
            if (interval.longLecture) {
                lecturesByDay[interval.day] = lecturesByDay[interval.day] || [];
                lecturesByDay[interval.day].push(interval);
            }
        });

        var count = 0;
        Object.keys(lecturesByDay).forEach(function (day) {
            var lectures = lecturesByDay[day];
            if (lectures.length < 3) {
                return;
            }

            lectures.sort(function (a, b) {
                return a.start - b.start;
            });

            var chainLength = 1;
            for (var i = 1; i < lectures.length; i++) {
                chainLength = lectures[i].start === lectures[i - 1].end ? chainLength + 1 : 1;
                if (chainLength >= 3) {
                    count++;
                    return;
                }
            }
        });

        return count;
    }

    // Picks a random lesson of each lesson type for the given courses, trying to
    // avoid conflicts between them and with the custom events, and avoiding days
    // with three back to back lectures of two hours.
    // currentSchedule: {course: {lessonType: lessonNumber}}, lesson types which
    // are hidden ('-') are kept hidden.
    // Returns {schedule: {course: {lessonType: lessonNumber}}, conflicts: number,
    // lectureTriples: number}.
    CourseCalendar.prototype.generateRandomSchedule = function (courses, currentSchedule) {
        var that = this;
        var calendar = that.element;

        // A slot is a lesson type of a course, with the lessons to choose from.
        var slots = [];
        courses.forEach(function (course) {
            var lessonsByType = {};
            initCreateCourseEvents(that, course).forEach(function (event) {
                var lessonType = getEventLessonType(event);
                var lessonNumber = event.lessonData['מס.'];
                lessonsByType[lessonType] = lessonsByType[lessonType] || {};
                lessonsByType[lessonType][lessonNumber] = lessonsByType[lessonType][lessonNumber] || [];
                lessonsByType[lessonType][lessonNumber].push(eventToInterval(event));
            });

            var currentLessons = currentSchedule[course] || {};
            Object.keys(lessonsByType).forEach(function (lessonType) {
                if (currentLessons[lessonType] === '-') {
                    return;
                }

                slots.push({
                    course: course,
                    lessonType: lessonType,
                    options: Object.keys(lessonsByType[lessonType]).map(function (lessonNumber) {
                        return {
                            lessonNumber: parseInt(lessonNumber, 10),
                            intervals: lessonsByType[lessonType][lessonNumber]
                        };
                    })
                });
            });
        });

        // Custom events which are displayed are treated as busy time.
        var busyIntervals = calendar.fullCalendar('clientEvents', function (event) {
            return event.courseNumber === null && event.start.week() === 1;
        }).map(eventToInterval);

        var best = null;
        var startTime = Date.now();
        for (var attempt = 0; attempt < 5000 && Date.now() - startTime < 1500; attempt++) {
            var busy = busyIntervals.slice();
            var lessons = [];
            var schedule = {};
            var conflicts = 0;

            shuffleArray(slots.slice()).forEach(function (slot) {
                // Prefer an option without overlaps, then one that doesn't
                // create three back to back lectures.
                var bestOption = null;
                var bestOptionScore = Infinity;
                var bestOptionOverlaps = 0;
                shuffleArray(slot.options.slice()).some(function (option) {
                    var overlaps = countIntervalOverlaps(option.intervals, busy);
                    var score = overlaps * 100;
                    if (score < bestOptionScore) {
                        score += countBackToBackLectureTriples(lessons.concat(option.intervals));
                    }
                    if (score < bestOptionScore) {
                        bestOption = option;
                        bestOptionScore = score;
                        bestOptionOverlaps = overlaps;
                    }
                    return score === 0;
                });

                busy = busy.concat(bestOption.intervals);
                lessons = lessons.concat(bestOption.intervals);
                conflicts += bestOptionOverlaps;
                schedule[slot.course] = schedule[slot.course] || {};
                schedule[slot.course][slot.lessonType] = bestOption.lessonNumber;
            });

            var lectureTriples = countBackToBackLectureTriples(lessons);

            // Conflicts are worse than back to back lectures.
            if (!best || conflicts < best.conflicts ||
                (conflicts === best.conflicts && lectureTriples < best.lectureTriples)) {
                best = {schedule: schedule, conflicts: conflicts, lectureTriples: lectureTriples};
            }

            if (conflicts === 0 && lectureTriples === 0) {
                break;
            }
        }

        return best || {schedule: {}, conflicts: 0, lectureTriples: 0};
    };

    CourseCalendar.prototype.showAddCustomEventDialog = function () {
        if (!this.readonly) {
            showAddCustomEventDialog(this);
        }
    };

    CourseCalendar.prototype.hasCustomEvents = function () {
        return getCustomEvents(this.element).length > 0;
    };

    CourseCalendar.prototype.getCustomEventGroups = function () {
        return getCustomEventGroups(this.element);
    };

    // filter.text - substring to match in the event title.
    // filter.group - null for all groups, '' for events without a group,
    // or a group name.
    CourseCalendar.prototype.setCustomEventFilter = function (filter) {
        this.customEventFilter = {
            text: filter.text || '',
            group: typeof filter.group === 'string' ? filter.group : null
        };
        this.element.fullCalendar('rerenderEvents');
    };

    CourseCalendar.prototype.renameCustomEventGroup = function (oldName, newName) {
        var that = this;
        var calendar = that.element;

        var events = getCustomEvents(calendar).filter(function (event) {
            return event.customGroup === oldName;
        });

        events.forEach(function (event) {
            event.customGroup = newName || null;
        });
        calendar.fullCalendar('updateEvents', events);

        events.forEach(function (event) {
            that.onCustomEventUpdated(event.id.replace(/^custom_event_/, ''), getCustomEventData(event));
        });
    };

    CourseCalendar.prototype.removeCustomEventGroup = function (name) {
        this.renameCustomEventGroup(name, null);
    };

    CourseCalendar.prototype.removeAll = function () {
        var that = this;
        var calendar = that.element;

        calendar.fullCalendar('removeEvents');

        updateCalendarMaxDayAndTime(calendar);
    };

    return CourseCalendar;
})();
