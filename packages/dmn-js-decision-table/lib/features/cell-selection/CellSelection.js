import {
  closest,
  delegate,
  event,
  matches,
  query
} from 'min-dom';

import {
  setRange,
  getRange
} from 'selection-ranges';

const ELEMENT_SELECTOR = '[data-element-id]';


/**
 * A cell selection utlity; allows selection of elements, independent from
 * whether they are backed by a business object or not.
 *
 * Works together with the {@link SelectionAware} trait.
 *
 * @param {RenderConfig} config
 * @param {EventBus} eventBus
 * @param {Sheet} sheet
 * @param {Selection} selection
 * @param {ElementRegistry} elementRegistry
 */
export default function CellSelection(
    config, eventBus, sheet,
    selection, elementRegistry) {

  const {
    container
  } = config;

  let lastSelection = null;

  function emit(elementId, newSelection) {

    eventBus.fire('selection.' + elementId + '.changed', newSelection);

    eventBus.fire('cellSelection.changed', {
      elementId: elementId,
      selection: newSelection
    });

  }

  function click(event) {

    const target = event.target;

    if (closest(target, '.no-deselect', true)) {
      return;
    }

    const selectionTarget = closest(target, ELEMENT_SELECTOR, true);

    const elementId = selectionTarget && getElementId(selectionTarget);

    realSelect(elementId);
  }

  function focus(event) {
    const elementId = getElementId(event.delegateTarget);

    return realSelect(elementId);
  }

  function unfocus(event) {
    const elementId = getElementId(event.delegateTarget);

    emit(elementId, {
      focussed: false
    });
  }

  function realSelect(elementId) {

    if (lastSelection !== elementId) {
      emit(lastSelection, {
        selected: false,
        focussed: false
      });
    }

    lastSelection = elementId;

    if (elementId) {
      emit(elementId, {
        selected: true,
        focussed: true
      });
    }

    if (elementId) {
      selection.select(elementId);
    } else {
      selection.deselect();
    }
  }

  event.bind(container, 'click', click);
  delegate.bind(container, ELEMENT_SELECTOR, 'focusin', focus);
  delegate.bind(container, ELEMENT_SELECTOR, 'focusout', unfocus);


  eventBus.on('table.destroy', function() {
    event.unbind(container, 'click', click);
    delegate.unbind(container, ELEMENT_SELECTOR, 'focusin', focus);
    delegate.unbind(container, ELEMENT_SELECTOR, 'focusout', unfocus);
  });

  eventBus.on('cellSelection.changed', function(event) {

    const {
      elementId,
      selection
    } = event;

    const actualElement = query(`[data-element-id="${elementId}"]`, container);

    if (selection.selected && actualElement) {
      ensureFocus(actualElement);
    }
  });

  eventBus.on('selection.changed', function(event) {

    const {
      selection
    } = event;

    if (selection) {
      realSelect(selection.id);
    }
  });

  // API
  this.isCellSelected = function() {
    return !!lastSelection;
  };

  this.selectCell = function(direction) {

    if (!lastSelection) {
      return;
    }

    if (direction !== 'above' && direction !== 'below') {
      throw new Error('direction must be any of { above, below }');
    }

    var selectionEl = getElement(lastSelection);

    const coords = getCoordinates(selectionEl);

    if (!coords) {
      return;
    }

    const {
      row,
      col
    } = coords;

    const rowIndex = parseInt(row, 10);

    const nextRowIndex = direction === 'above' ? rowIndex - 1 : rowIndex + 1;

    const nextEl = getElementByCoords({
      row: nextRowIndex,
      col
    }, container);

    if (!nextEl) {
      return;
    }

    const nextElId = getElementId(nextEl);

    if (nextElId) {
      realSelect(nextElId, {
        focussed: true,
        selected: true
      });
    }


  };
}

CellSelection.$inject = [
  'config.renderer',
  'eventBus',
  'sheet',
  'selection',
  'elementRegistry'
];


// helpers ///////////////////

function getCoordinates(el) {
  const coordsAttr = el.getAttribute('data-coords');

  if (!coordsAttr) {
    return null;
  }

  const [ row, col ] = coordsAttr.split(':');

  return {
    row,
    col
  };
}

function getElementId(el) {
  return el.getAttribute('data-element-id');
}

function getElementByCoords(coords, container) {
  const coordsAttr = `${coords.row}:${coords.col}`;

  return query(`[data-coords="${coordsAttr}"]`, container);
}

function getElement(id, container) {
  return query(`[data-element-id="${id}"]`, container);
}

const selectableSelector = '[contenteditable]';

function ensureFocus(el) {

  if (matches(el, selectableSelector)) {
    return;
  }

  const focusEl = query(selectableSelector, el);

  if (focusEl) {
    focusEl.focus();

    const range = getRange(focusEl);

    if (!range || range.end === 0) {
      setRange(focusEl, { start: 5000, end: 5000 });
    }

  }
}