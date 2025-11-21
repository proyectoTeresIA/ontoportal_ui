// Navigable entities - tienen su propia sección en el frontend
var navigableEntities = {
  lexicalForm: 'forms',
  form: 'forms',
  sense: 'lexical_senses',
  lexicalSense: 'lexical_senses',
  isLexicalizedSenseOf: 'lexical_concepts',
  isSenseOf: 'lexical_entries',
  evokes: 'lexical_concepts',
  isEvokedBy: 'lexical_entries',
  lexicalConcept: 'lexical_concepts',
  translation: 'lexical_senses',
  synonym: 'lexical_senses',
  broader: 'lexical_concepts',
  narrower: 'lexical_concepts',
  related: 'lexical_concepts',
  lexicalizedSense: 'lexical_senses',
  influenced: 'lexical_entries',
  hasDerivation: 'lexical_entries',
  differentFrom: 'lexical_concepts',
  antonym: 'lexical_concepts',
  mappingRelation: 'lexical_concepts',
  broadMatch: 'lexical_concepts',
  closeMatch: 'lexical_concepts',
  exactMatch: 'lexical_concepts',
  narrowMatch: 'lexical_concepts',
  relatedMatch: 'lexical_concepts',
  isPartOf: 'lexical_concepts',
  hasPart: 'lexical_concepts',
  capital: 'lexical_concepts',
  currency: 'lexical_concepts',
  causedBy: 'lexical_entries',
  precedesInTime: 'lexical_entries',
  followsInTime: 'lexical_entries',
  hasLocation: 'lexical_entries',
};

// Embedded objects - deben expandirse inline mostrando todos sus campos
var embeddedObjects = [
  'definition',
  'note',
  'signedForm',
  'signedRep',
  'usageExample',
  'usage',
  'reference',
  'video',
  'wasDerivedFrom',
  'wasInfluencedBy',
  'hasDerivation',
  'activity',
  'agent',
];

// Fields to skip rendering
var skipFields = ['@id', '@type', '@context', 'links', 'submission'];

window.OntolexRenderer = {
  // Generic function to render all fields of an entity
  renderAllFields: function (data, ontAcronym) {
    var html = '';

    for (var key in data) {
      if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
      if (skipFields.indexOf(key) !== -1) continue;

      var value = data[key];
      if (value === null || value === undefined) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (typeof value === 'string' && value.trim() === '') continue;

      // Determinar si este campo es navegable o embebido
      var isNavigable = Object.prototype.hasOwnProperty.call(navigableEntities, key);
      var isEmbedded = embeddedObjects.indexOf(key) !== -1;

      // Format field label
      var label = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, function (str) {
        return str.toUpperCase();
      });

      html += '<div class="mb-3 ontolex-field">';
      html += '<strong class="field-label">' + label + ':</strong> ';
      html +=
        '<div class="field-value ps-3">' +
        this.renderFieldValue(value, key, isNavigable ? navigableEntities[key] : null, ontAcronym, isEmbedded) +
        '</div>';
      html += '</div>';
    }

    return html;
  },

  renderFieldValue: function (value, fieldName, entityType, ontAcronym, isEmbedded) {
    if (Array.isArray(value)) {
      if (value.length === 0) return '<span class="text-muted">-</span>';
      var html = '<ul class="list-unstyled mb-0">';
      for (var i = 0; i < value.length; i++) {
        html +=
          '<li class="mb-2">' +
          this.renderSingleValue(value[i], fieldName, entityType, ontAcronym, isEmbedded) +
          '</li>';
      }
      html += '</ul>';
      return html;
    } else {
      return this.renderSingleValue(value, fieldName, entityType, ontAcronym, isEmbedded);
    }
  },

  renderSingleValue: function (value, fieldName, entityType, ontAcronym, isEmbedded) {
    // Si es un objeto embebido, expandirlo mostrando todos sus campos
    if (isEmbedded && typeof value === 'object' && value !== null) {
      return this.renderEmbeddedObject(value, ontAcronym);
    }

    if (typeof value === 'object' && value !== null && value['@id']) {
      // It's a reference to another entity
      var objLabel =
        value.label || value.prefLabel || value.writtenRep || value.value || this.extractIdFragment(value['@id']);
      if (entityType) {
        var objLinkUrl = '/ontologies/' + ontAcronym + '?p=' + entityType + '&id=' + encodeURIComponent(value['@id']);
        return (
          '<a href="' +
          objLinkUrl +
          '" class="entity-link text-decoration-none" data-turbo="false">' +
          '<i class="fas fa-link me-1"></i>' +
          this.escapeHtml(objLabel) +
          '</a>'
        );
      } else {
        return '<span class="ontolex-value">' + this.escapeHtml(objLabel) + '</span>';
      }
    } else if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
      // It's a URI
      if (entityType) {
        var uriLabel = this.extractIdFragment(value);
        var uriLinkUrl = '/ontologies/' + ontAcronym + '?p=' + entityType + '&id=' + encodeURIComponent(value);
        return (
          '<a href="' +
          uriLinkUrl +
          '" class="entity-link text-decoration-none" data-turbo="false">' +
          '<i class="fas fa-link me-1"></i>' +
          this.escapeHtml(uriLabel) +
          '</a>'
        );
      } else {
        // Extract vocabulary term or show full URI
        return (
          '<a href="' +
          value +
          '" target="_blank" class="external-link text-decoration-none"><code class="small">' +
          this.escapeHtml(this.extractIdIfVocabularyTerm(value)) +
          '</code></a>'
        );
      }
    } else {
      // Simple value
      return '<span>' + this.escapeHtml(String(value)) + '</span>';
    }
  },

  // Renderizar un objeto embebido mostrando todos sus campos
  renderEmbeddedObject: function (obj, ontAcronym) {
    var html = '<div class="embedded-object border rounded p-2 bg-light">';
    var embeddedFieldsToSkip = skipFields + ['hasDerivation', 'wasAssociatedFor', 'influenced'];

    // Primero mostrar el @id si existe
    if (obj['@id']) {
      html += '<div class="mb-2 small"><strong>ID:</strong> <code class="ms-1">' + obj['@id'] + '</code></div>';
    }

    // Luego mostrar el resto de campos
    for (var key in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      if (
        key === '@id' ||
        (embeddedFieldsToSkip.indexOf(key) !== -1 &&
          (typeof obj[key] !== 'object' || (Array.isArray(obj[key]) && obj[key].forEach((v) => typeof v) !== 'object')))
      )
        continue;

      var val = obj[key];
      if (val === null || val === undefined) continue;
      if (Array.isArray(val) && val.length === 0) continue;
      if (typeof val === 'string' && val.trim() === '') continue;

      var fieldLabel = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, function (str) {
        return str.toUpperCase();
      });

      html += '<div class="mb-1 small">';
      html += '<strong>' + fieldLabel + ':</strong> ';
      html += this.renderEmbeddedFieldValue(val, key, ontAcronym);
      html += '</div>';
    }

    html += '</div>';
    return html;
  },

  // Renderizar el valor de un campo dentro de un objeto embebido
  renderEmbeddedFieldValue: function (value, fieldName, ontAcronym) {
    if (Array.isArray(value)) {
      if (value.length === 0) return '<span class="text-muted">-</span>';
      var items = [];
      for (var i = 0; i < value.length; i++) {
        items.push(
          this.renderEmbeddedSingleValue(
            value[i],
            fieldName,
            ontAcronym,
            navigableEntities[fieldName],
            embeddedObjects.indexOf(fieldName) !== -1,
          ),
        );
      }
      return items;
    } else {
      return this.renderEmbeddedSingleValue(
        value,
        fieldName,
        ontAcronym,
        navigableEntities[fieldName],
        embeddedObjects.indexOf(fieldName) !== -1,
      );
    }
  },

  // Renderizar un valor simple dentro de un objeto embebido
  renderEmbeddedSingleValue: function (value, fieldName, ontAcronym, entityType, isNestedEmbedded) {
    // Si es un objeto embebido anidado, expandirlo recursivamente
    if (isNestedEmbedded && typeof value === 'object' && value !== null) {
      return this.renderEmbeddedObject(value, ontAcronym);
    }

    if (typeof value === 'object' && value !== null && value['@id']) {
      var embLabel =
        value.label || value.prefLabel || value.writtenRep || value.value || this.extractIdFragment(value['@id']);
      if (entityType) {
        var embLinkUrl = '/ontologies/' + ontAcronym + '?p=' + entityType + '&id=' + encodeURIComponent(value['@id']);
        return (
          '<a href="' +
          embLinkUrl +
          '" class="entity-link text-decoration-none" data-turbo="false">' +
          '<i class="fas fa-link me-1"></i>' +
          this.escapeHtml(embLabel) +
          '</a>'
        );
      } else {
        return '<span>' + this.escapeHtml(embLabel) + '</span>';
      }
    } else if (typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'))) {
      if (entityType) {
        var embUriLabel = this.extractIdFragment(value);
        var embUriLinkUrl = '/ontologies/' + ontAcronym + '?p=' + entityType + '&id=' + encodeURIComponent(value);
        return (
          '<a href="' +
          embUriLinkUrl +
          '" class="entity-link text-decoration-none" data-turbo="false">' +
          '<i class="fas fa-link me-1"></i>' +
          this.escapeHtml(embUriLabel) +
          '</a>'
        );
      } else {
        return (
          '<a href="' +
          value +
          '" target="_blank" class="external-link text-decoration-none"><code class="small">' +
          this.escapeHtml(this.extractIdIfVocabularyTerm(value)) +
          '</code></a>'
        );
      }
    } else {
      return '<span>' + this.escapeHtml(String(value)) + '</span>';
    }
  },

  extractIdFragment: function (uri) {
    if (!uri) return '';
    var parts = uri.split(/[#/]/);
    return parts[parts.length - 1] || uri;
  },

  extractIdIfVocabularyTerm: function (uri) {
    if (!uri) return '';
    var vocabularies = [
      'http://purl.org/',
      'http://www.w3.org/',
      'http://lexvo.org/',
      'http://www.lexinfo.net/',
      'https://termlex.oeg.fi.upm.es/',
    ];
    for (var i = 0; i < vocabularies.length; i++) {
      if (uri.startsWith(vocabularies[i])) {
        return this.extractIdFragment(uri);
      }
    }
    return uri;
  },

  escapeHtml: function (text) {
    var map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, function (m) {
      return map[m];
    });
  },
};
