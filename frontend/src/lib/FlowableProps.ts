import { is } from 'bpmn-js/lib/util/ModelUtil';

export const flowableModdleDescriptor = {
  name: 'Flowable',
  uri: 'http://flowable.org/bpmn',
  prefix: 'flowable',
  xml: { tagAlias: 'lowerCase' },
  types: [
    { name: 'CandidateGroups', superClass: ['Element'], properties: [{ name: 'value', type: 'String', isBody: true }] },
    { name: 'CandidateUsers', superClass: ['Element'], properties: [{ name: 'value', type: 'String', isBody: true }] },
    { name: 'Assignee', superClass: ['Element'], properties: [{ name: 'value', type: 'String', isBody: true }] },
  ]
};

export default class FlowablePropertiesProvider {
  static $inject = ['propertiesPanel', 'injector', 'eventBus'];

  private _injector: any;

  constructor(propertiesPanel: any, injector: any, eventBus: any) {
    propertiesPanel.registerProvider(600, this);
    this._injector = injector;
    eventBus.on('selection.changed', () => { /* re-render trigger */ });
  }

  getGroups(element: any) {
    try {
      return this._buildGroups(element);
    } catch (err) {
      console.warn('FlowableProps error:', err);
      return [];
    }
  }

  _buildGroups(element: any) {
    const groups: any[] = [];
    const bo = element?.businessObject;
    if (!bo || bo.$type !== 'bpmn:UserTask') return groups;

    const bpmnFactory = this._injector.get('bpmnFactory');
    const modeling = this._injector.get('modeling');

    const extVal = (name: string): string => {
      const ee = bo.get('extensionElements');
      if (!ee) return '';
      const vals: any[] = ee.get('values') || [];
      const found = vals.find(v => v.$type === 'flowable:' + name);
      return found ? (found.get('value') || '') : '';
    };

    const setVal = (name: string, value: string) => {
      const ee = bo.get('extensionElements');
      const vals: any[] = ee ? [...(ee.get('values') || [])] : [];
      const existing = vals.find(v => v.$type === 'flowable:' + name);

      if (!value) {
        const filtered = vals.filter(v => v.$type !== 'flowable:' + name);
        const newEE = filtered.length
          ? bpmnFactory.create('bpmn:ExtensionElements', { values: filtered })
          : null;
        modeling.updateModdleProperties(element, bo, { extensionElements: newEE });
        return;
      }

      const newEl = bpmnFactory.create('flowable:' + name, { value });
      const newVals = existing
        ? vals.map(v => v === existing ? newEl : v)
        : [...vals, newEl];
      const newEE = bpmnFactory.create('bpmn:ExtensionElements', { values: newVals });
      modeling.updateModdleProperties(element, bo, { extensionElements: newEE });
    };

    const entry = (label: string, name: string, desc: string) => new FlowableEntry({
      label, description: desc,
      getValue: () => extVal(name),
      setValue: (v: string) => setVal(name, v),
    });

    groups.push({
      id: 'flowable-assignment',
      label: 'Flowable Assignment',
      entries: [
        entry('Assignee', 'Assignee', 'User ID'),
        entry('Candidate Users', 'CandidateUsers', 'Comma-separated user IDs'),
        entry('Candidate Groups', 'CandidateGroups', '${groupId} or IDs'),
      ],
    });

    return groups;
  }
}

class FlowableEntry {
  label: string;
  description: string;
  getValue: () => string;
  setValue: (v: string) => void;

  constructor(props: any) {
    this.label = props.label;
    this.description = props.description || '';
    this.getValue = props.getValue;
    this.setValue = props.setValue;
  }

  render() {
    const div = document.createElement('div');
    div.setAttribute('data-entry-id', 'FlowableProps');

    const label = document.createElement('label');
    label.textContent = this.label;
    Object.assign(label.style, {
      display: 'block', fontSize: '12px', fontWeight: 500,
      marginBottom: '4px', color: '#374151',
    });
    div.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = this.getValue();
    Object.assign(input.style, {
      width: '100%', padding: '4px 8px', fontSize: '13px',
      border: '1px solid #d1d5db', borderRadius: '4px',
      background: 'white',
    });
    input.addEventListener('input', () => this.setValue(input.value));
    div.appendChild(input);

    if (this.description) {
      const desc = document.createElement('div');
      desc.textContent = this.description;
      Object.assign(desc.style, { fontSize: '11px', color: '#9ca3af', marginTop: '2px' });
      div.appendChild(desc);
    }
    Object.assign(div.style, { padding: '8px 0' });

    return div;
  }
}
