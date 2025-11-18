// OntoLex Modal Functionality
// Shared across all OntoLex model views

// Store config in window object to survive script reloads
window.OntolexModalConfig = window.OntolexModalConfig || {
  ontologyAcronym: null,
  externalRestUrl: null,
  apikey: null,
  modalInstance: null,
};

window.OntolexModal = (function () {
  function init(acronym, restUrl, key) {
    window.OntolexModalConfig.ontologyAcronym = acronym;
    window.OntolexModalConfig.externalRestUrl = restUrl;
    window.OntolexModalConfig.apikey = key;

    $(document)
      .off('click', '.entity-link')
      .on('click', '.entity-link', function (e) {
        e.preventDefault();
        var type = $(this).data('type');
        var id = $(this).data('id');
        var title = $(this).text();
        loadEntity(type, id, title);
      });

    // Show remaining (previously hidden) items in lists when the "... and X more" link is clicked
    $(document)
      .off('click', '.ontolex-show-more')
      .on('click', '.ontolex-show-more', function (e) {
        e.preventDefault();
        var $linkLi = $(this).closest('li');
        // Reveal any hidden sibling items (they may be rendered before or after the link)
        $linkLi.siblings('.ontolex-hidden-item').removeClass('d-none');
        // Remove the "show more" link list item
        $linkLi.remove();
      });
  }

  function loadEntity(type, id, title) {
    // Use config from window object
    var ontologyAcronym = window.OntolexModalConfig.ontologyAcronym;
    var externalRestUrl = window.OntolexModalConfig.externalRestUrl;
    var apikey = window.OntolexModalConfig.apikey;

    // Validate that we have the required context
    if (!ontologyAcronym || !externalRestUrl || !apikey) {
      console.error('OntolexModal not properly initialized', {
        ontologyAcronym: ontologyAcronym,
        externalRestUrl: externalRestUrl,
        apikey: apikey,
      });
      return;
    }

    // Find the modal element (should always exist in the layout now)
    var modalElement = document.getElementById('ontolexModal');
    if (!modalElement) {
      console.error('Modal element #ontolexModal not found in DOM');
      return;
    }

    // Update modal content
    $('#ontolexModal .modal-title').text(title || 'OntoLex Entity Details');
    $('#ontolexModalContent').html(
      '<p class="text-center"><span class="spinner-border spinner-border-sm" role="status"></span><span class="ms-2">Loading...</span></p>',
    );

    // Get or create modal instance (singleton pattern - only created once)
    if (!window.OntolexModalConfig.modalInstance) {
      window.OntolexModalConfig.modalInstance = new bootstrap.Modal(modalElement, {
        backdrop: true,
        keyboard: true,
        focus: true,
      });

      // Set up cleanup when modal is hidden (only once)
      $(modalElement).on('hidden.bs.modal', function () {
        $('.modal-backdrop').remove();
        $('body').removeClass('modal-open').css('overflow', '').css('padding-right', '');
      });
    }

    // Show the modal
    window.OntolexModalConfig.modalInstance.show();

    var apiUrl =
      externalRestUrl +
      '/ontologies/' +
      ontologyAcronym +
      '/' +
      type +
      '/' +
      encodeURIComponent(id) +
      '?apikey=' +
      apikey;

    $.ajax({
      url: apiUrl,
      method: 'GET',
      dataType: 'json',
      success: function (data) {
        var html = renderEntityDetails(type, data);
        $('#ontolexModalContent').html(html);
      },
      error: function (xhr, status, error) {
        $('#ontolexModalContent').html('<div class="alert alert-danger">Error loading details: ' + error + '</div>');
      },
    });
  }

  function renderEntityDetails(type, data) {
    var html = '<div class="entity-details">';
    var itemId = data['@id'] || data.id || 'Unknown';

    if (type === 'lexical_concepts') {
      html += '<h6>Lexical Concept</h6>';
      html += '<p class="text-muted small mb-3"><strong>ID:</strong> <code>' + itemId + '</code></p>';

      // Definitions - expanded with value and language
      if (data.definition && Array.isArray(data.definition) && data.definition.length > 0) {
        html += '<div class="mb-3"><strong class="d-block mb-2">Definitions (' + data.definition.length + '):</strong>';
        html += '<ul class="list-unstyled ps-3">';
        data.definition.forEach(function (def) {
          if (typeof def === 'object') {
            // Try to get a meaningful text from the definition object
            var text =
              def.value || def.label || (def['@id'] ? def['@id'].split('/').pop().split('#').pop() : 'Definition');
            html += '<li class="mb-2 small">';
            html += text;
            if (def.language) {
              html += ' <span class="ontolex-badge badge-language ms-2">' + def.language + '</span>';
            }
            if (def.wasDerivedFrom) {
              var refs = Array.isArray(def.wasDerivedFrom) ? def.wasDerivedFrom : [def.wasDerivedFrom];
              html += '<div class="text-muted small ms-3 mt-1">References: ';
              refs.forEach(function (ref, idx) {
                if (idx > 0) html += ', ';
                if (typeof ref === 'object') {
                  // Try to get a meaningful text from the reference object
                  var refText =
                    ref.label || ref.value || (ref['@id'] ? ref['@id'].split('/').pop().split('#').pop() : 'Reference');
                  html += refText;
                } else {
                  html += ref;
                }
              });
              html += '</div>';
            }
            html += '</li>';
          } else {
            html += '<li class="mb-1 small"><code>' + def + '</code></li>';
          }
        });
        html += '</ul></div>';
      }

      if (data.subject && data.subject.prefLabel) {
        html +=
          '<div class="mb-3"><strong>Subject:</strong> <span class="ontolex-badge badge-subject ms-2">' +
          data.subject.prefLabel +
          '</span></div>';
      }

      // Source
      if (data.source) {
        html +=
          '<div class="mb-3"><strong>Source:</strong> <div class="mt-1 small text-break">' +
          data.source +
          '</div></div>';
      }

      if (data.inScheme) {
        html +=
          '<div class="mb-3"><strong>In Scheme:</strong> <div class="mt-1"><code class="small">' +
          data.inScheme +
          '</code></div></div>';
      }

      // Semantic Relations - all in compact format with source indication
      var semanticRelations = [
        { key: 'broader', label: 'Broader' },
        { key: 'narrower', label: 'Narrower' },
        { key: 'related', label: 'Related' },
        { key: 'differentFrom', label: 'Different From' },
        { key: 'antonym', label: 'Antonym' },
        { key: 'isPartOf', label: 'Is Part Of' },
        { key: 'hasPart', label: 'Has Part' },
        { key: 'capital', label: 'Capital' },
        { key: 'currency', label: 'Currency' },
        { key: 'causedBy', label: 'Caused By' },
        { key: 'precedesInTime', label: 'Precedes In Time' },
        { key: 'followsInTime', label: 'Follows In Time' },
        { key: 'hasLocation', label: 'Has Location' },
      ];

      var hasAnyRelation = semanticRelations.some(function (rel) {
        return data[rel.key] && data[rel.key].length > 0;
      });

      if (hasAnyRelation) {
        html += '<div class="mb-3"><strong class="d-block mb-2">Semantic Relations:</strong>';
        html += '<div class="ps-3">';
        semanticRelations.forEach(function (rel) {
          if (data[rel.key] && data[rel.key].length > 0) {
            html += '<div class="mb-2 small"><strong>' + rel.label + ':</strong> ';
            var items = Array.isArray(data[rel.key]) ? data[rel.key] : [data[rel.key]];
            items.slice(0, 5).forEach(function (uri, idx) {
              if (idx > 0) html += ', ';
              var shortId = uri.split('/').pop();
              html += '<code class="small">' + shortId + '</code>';
            });
            if (items.length > 5) {
              html += ' <span class="text-muted">+' + (items.length - 5) + ' more</span>';
            }
            html += '</div>';
          }
        });
        html += '</div></div>';
      }

      if (data.isEvokedBy && data.isEvokedBy.length > 0) {
        html +=
          '<div class="mb-3"><strong class="d-block mb-2">Evoked By (' + data.isEvokedBy.length + ' entries):</strong>';
        html += '<ul class="list-unstyled ps-3">';
        data.isEvokedBy.slice(0, 10).forEach(function (entryId) {
          html +=
            '<li class="mb-1"><a href="#" class="entity-link text-decoration-none" data-type="lexical_entries" data-id="' +
            entryId +
            '"><i class="fas fa-link me-1"></i>' +
            entryId.split('/').pop() +
            '</a></li>';
        });
        // Render remaining items hidden and add a show-more link
        var _remainingEvoked = data.isEvokedBy.slice(10);
        _remainingEvoked.forEach(function (entryId) {
          html +=
            '<li class="mb-1 ontolex-hidden-item d-none"><a href="#" class="entity-link text-decoration-none" data-type="lexical_entries" data-id="' +
            entryId +
            '"><i class="fas fa-link me-1"></i>' +
            entryId.split('/').pop() +
            '</a></li>';
        });
        if (_remainingEvoked.length > 0) {
          html +=
            '<li><a href="#" class="ontolex-show-more text-muted small">... and ' +
            _remainingEvoked.length +
            ' more</a></li>';
        }
        html += '</ul></div>';
      }

      // Notes
      if (data.note && data.note.length > 0) {
        html += '<div class="mb-3"><strong class="d-block mb-2">Notes (' + data.note.length + '):</strong>';
        html += '<ul class="list-unstyled ps-3">';
        data.note.slice(0, 10).forEach(function (n) {
          if (typeof n === 'object') {
            var text = n.value || n.label || 'Note';
            html += '<li class="mb-2 small">' + text;
            if (n.language) {
              html += ' <span class="ontolex-badge badge-language ms-2">' + n.language + '</span>';
            }
            if (n.wasDerivedFrom) {
              var refs = Array.isArray(n.wasDerivedFrom) ? n.wasDerivedFrom : [n.wasDerivedFrom];
              html += '<div class="text-muted small ms-3 mt-1">References: ';
              refs.forEach(function (ref, idx) {
                if (idx > 0) html += ', ';
                if (typeof ref === 'object') {
                  // Try to get a meaningful text from the reference object
                  var refText =
                    ref.label || ref.value || (ref['@id'] ? ref['@id'].split('/').pop().split('#').pop() : 'Reference');
                  html += refText;
                } else {
                  html += ref;
                }
              });
              html += '</div>';
            }
            html += '</li>';
          } else {
            html += '<li class="mb-1 small">' + n + '</li>';
          }
        });
        var _remainingNotes = data.note.slice(10);
        _remainingNotes.forEach(function (n) {
          if (typeof n === 'object') {
            var text = n.value || n.label || 'Note';
            html += '<li class="mb-2 small ontolex-hidden-item d-none">' + text;
            if (n.language) {
              html += ' <span class="ontolex-badge badge-language ms-2">' + n.language + '</span>';
            }
            if (n.wasDerivedFrom) {
              var refs = Array.isArray(n.wasDerivedFrom) ? n.wasDerivedFrom : [n.wasDerivedFrom];
              html += '<div class="text-muted small ms-3 mt-1">References: ';
              refs.forEach(function (ref, idx) {
                if (idx > 0) html += ', ';
                if (typeof ref === 'object') {
                  var refText =
                    ref.label || ref.value || (ref['@id'] ? ref['@id'].split('/').pop().split('#').pop() : 'Reference');
                  html += refText;
                } else {
                  html += ref;
                }
              });
              html += '</div>';
            }
            html += '</li>';
          } else {
            html += '<li class="mb-1 small ontolex-hidden-item d-none">' + n + '</li>';
          }
        });
        if (_remainingNotes.length > 0) {
          html +=
            '<li><a href="#" class="ontolex-show-more text-muted small">... and ' +
            _remainingNotes.length +
            ' more</a></li>';
        }
        html += '</ul></div>';
      }

      // Mappings (exactMatch, closeMatch, broaderMatch, etc.)
      var mappingProps = ['exactMatch', 'closeMatch', 'broadMatch', 'narrowMatch', 'relatedMatch', 'mappingRelation'];
      mappingProps.forEach(function (prop) {
        if (data[prop] && data[prop].length > 0) {
          html += '<div class="mb-3"><strong class="d-block mb-2">' + prop + ' (' + data[prop].length + '):</strong>';
          html += '<ul class="list-unstyled ps-3">';
          data[prop].slice(0, 10).forEach(function (mId) {
            html += '<li class="mb-1"><code>' + mId + '</code></li>';
          });
          var _remainingMap = data[prop].slice(10);
          _remainingMap.forEach(function (mId) {
            html += '<li class="mb-1 ontolex-hidden-item d-none"><code>' + mId + '</code></li>';
          });
          if (_remainingMap.length > 0) {
            html +=
              '<li><a href="#" class="ontolex-show-more text-muted small">... and ' +
              _remainingMap.length +
              ' more</a></li>';
          }
          html += '</ul></div>';
        }
      });

      if (data.lexicalizedSense && data.lexicalizedSense.length > 0) {
        html +=
          '<div class="mb-3"><strong class="d-block mb-2">Lexicalized Senses (' +
          data.lexicalizedSense.length +
          '):</strong>';
        html += '<ul class="list-unstyled ps-3">';
        data.lexicalizedSense.slice(0, 10).forEach(function (senseId) {
          html +=
            '<li class="mb-1"><a href="#" class="entity-link text-decoration-none" data-type="lexical_senses" data-id="' +
            senseId +
            '"><i class="fas fa-link me-1"></i>' +
            senseId.split('/').pop() +
            '</a></li>';
        });
        var _remainingLexSenses = data.lexicalizedSense.slice(10);
        _remainingLexSenses.forEach(function (senseId) {
          html +=
            '<li class="mb-1 ontolex-hidden-item d-none"><a href="#" class="entity-link text-decoration-none" data-type="lexical_senses" data-id="' +
            senseId +
            '"><i class="fas fa-link me-1"></i>' +
            senseId.split('/').pop() +
            '</a></li>';
        });
        if (_remainingLexSenses.length > 0) {
          html +=
            '<li><a href="#" class="ontolex-show-more text-muted small">... and ' +
            _remainingLexSenses.length +
            ' more</a></li>';
        }
        html += '</ul></div>';
      }
    } else if (type === 'lexical_entries') {
      html += '<h6>Lexical Entry</h6>';
      html += '<p class="text-muted small mb-3"><strong>ID:</strong> <code>' + itemId + '</code></p>';

      var writtenRep = 'N/A';
      if (data.canonicalForm && data.canonicalForm.writtenRep) {
        writtenRep = data.canonicalForm.writtenRep;
      } else if (data.form && Array.isArray(data.form) && data.form.length > 0 && data.form[0].writtenRep) {
        writtenRep = data.form[0].writtenRep;
      }
      html += '<div class="mb-3"><strong>Written Form:</strong> <span class="ms-2">' + writtenRep + '</span></div>';

      if (data.language) {
        var langCode = data.language.split('/').pop();
        html +=
          '<div class="mb-3"><strong>Language:</strong> <span class="ontolex-badge badge-language ms-2">' +
          langCode +
          '</span></div>';
      }

      // Provenance fields
      if (data.wasDerivedFrom) {
        var derived = Array.isArray(data.wasDerivedFrom) ? data.wasDerivedFrom : [data.wasDerivedFrom];
        html += '<div class="mb-3"><strong class="d-block mb-2">Derived From:</strong><ul class="ps-3">';
        derived.forEach(function (d) {
          if (typeof d === 'object' && d['@id']) {
            var refText = d.label || d.value || d['@id'];
            html += '<li class="small"><code>' + refText + '</code></li>';
          } else {
            html += '<li class="small"><code>' + d + '</code></li>';
          }
        });
        html += '</ul></div>';
      }

      if (data.wasInfluencedBy) {
        var infl = Array.isArray(data.wasInfluencedBy) ? data.wasInfluencedBy : [data.wasInfluencedBy];
        html += '<div class="mb-3"><strong class="d-block mb-2">Influenced By (Activities):</strong><ul class="ps-3">';
        infl.forEach(function (activity) {
          if (typeof activity === 'object' && activity['@id']) {
            var actText =
              (activity.label || 'Activity') + (activity.endedAtTime ? ' (' + activity.endedAtTime + ')' : '');
            html += '<li class="small">' + actText;
            if (activity.hasDerivation) {
              var agents = Array.isArray(activity.hasDerivation) ? activity.hasDerivation : [activity.hasDerivation];
              html += ' <em class="text-muted">by:</em> ';
              agents.forEach(function (agent, idx) {
                if (idx > 0) html += ', ';
                if (typeof agent === 'object' && agent.name) {
                  html += agent.name + (agent.mbox ? ' &lt;' + agent.mbox + '&gt;' : '');
                } else {
                  html += agent;
                }
              });
            }
            html += '</li>';
          } else {
            html += '<li class="small"><code>' + activity + '</code></li>';
          }
        });
        html += '</ul></div>';
      }

      if (data.casNumber) {
        html += '<div class="mb-3"><strong>CAS Number:</strong> <span class="ms-2">' + data.casNumber + '</span></div>';
      }

      if (data.code) {
        html += '<div class="mb-3"><strong>Code:</strong> <span class="ms-2">' + data.code + '</span></div>';
      }

      if (data.hasValency && data.hasValency.length > 0) {
        html += '<div class="mb-3"><strong>Has Valency:</strong> ';
        data.hasValency.forEach(function (val, idx) {
          if (idx > 0) html += ', ';
          var valShort = val.split('#').pop() || val.split('/').pop();
          html += '<span class="ontolex-badge badge-pos ms-1">' + valShort + '</span>';
        });
        html += '</div>';
      }

      // Signed Form with Videos
      if (data.signedForm && data.signedForm.length > 0) {
        html +=
          '<div class="mb-3"><strong class="d-block mb-2">Signed Forms (' + data.signedForm.length + '):</strong>';
        html += '<ul class="list-unstyled ps-3">';
        data.signedForm.forEach(function (sf) {
          if (typeof sf === 'object') {
            html += '<li class="mb-2 small">';
            if (sf.signedRep) {
              var videos = Array.isArray(sf.signedRep) ? sf.signedRep : [sf.signedRep];
              videos.forEach(function (vid) {
                if (typeof vid === 'object' && vid.url) {
                  html += '<a href="' + vid.url + '" target="_blank" class="text-decoration-none">';
                  html += '<i class="fas fa-video me-1"></i>Video';
                  html += '</a>';
                } else {
                  html += '<code>' + vid + '</code>';
                }
              });
            }
            html += '</li>';
          } else {
            html += '<li class="mb-1 small"><code>' + sf + '</code></li>';
          }
        });
        html += '</ul></div>';
      }

      if (data.partOfSpeech) {
        var pos = data.partOfSpeech.split('#').pop() || data.partOfSpeech.split('/').pop();
        html +=
          '<div class="mb-3"><strong>Part of Speech:</strong> <span class="ontolex-badge badge-pos ms-2">' +
          pos +
          '</span></div>';
      }

      if (data.evokes) {
        var evokesId = Array.isArray(data.evokes) ? data.evokes[0] : data.evokes;
        html +=
          '<div class="mb-3"><strong>Evokes Concept:</strong> <a href="#" class="entity-link ms-2" data-type="lexical_concepts" data-id="' +
          evokesId +
          '"><i class="fas fa-link me-1"></i>' +
          evokesId.split('/').pop() +
          '</a></div>';
      }

      if (data.form && Array.isArray(data.form) && data.form.length > 0) {
        html += '<div class="mb-3"><strong class="d-block mb-2">Forms (' + data.form.length + '):</strong>';
        html += '<ul class="list-unstyled ps-3">';
        data.form.forEach(function (form) {
          var formId = typeof form === 'string' ? form : form['@id'] || form.id;
          var formLabel = form.writtenRep || formId.split('/').pop();
          html +=
            '<li class="mb-1"><a href="#" class="entity-link text-decoration-none" data-type="forms" data-id="' +
            formId +
            '"><i class="fas fa-link me-1"></i>' +
            formLabel +
            '</a></li>';
        });
        html += '</ul></div>';
      }

      // Term type (if present on entry)
      if (data.termType) {
        html += '<div class="mb-3"><strong>Term Type:</strong> <span class="ms-2">' + data.termType + '</span></div>';
      }

      if (data.sense && Array.isArray(data.sense) && data.sense.length > 0) {
        html += '<div class="mb-3"><strong class="d-block mb-2">Senses (' + data.sense.length + '):</strong>';
        html += '<ul class="list-unstyled ps-3">';
        data.sense.forEach(function (sense) {
          var senseId = typeof sense === 'string' ? sense : sense['@id'] || sense.id;
          html +=
            '<li class="mb-1"><a href="#" class="entity-link text-decoration-none" data-type="lexical_senses" data-id="' +
            senseId +
            '"><i class="fas fa-link me-1"></i>' +
            senseId.split('/').pop() +
            '</a></li>';
        });
        html += '</ul></div>';
      }
    } else if (type === 'forms') {
      html += '<h6>Form</h6>';
      html += '<p class="text-muted small mb-3"><strong>ID:</strong> <code>' + itemId + '</code></p>';

      if (data.writtenRep) {
        html +=
          '<div class="mb-3"><strong>Written Representation:</strong> <span class="ms-2">' +
          data.writtenRep +
          '</span></div>';
      }

      if (data.gender) {
        var gender = data.gender.split('#').pop() || data.gender.split('/').pop();
        html +=
          '<div class="mb-3"><strong>Gender:</strong> <span class="ontolex-badge badge-gender ms-2">' +
          gender +
          '</span></div>';
      }

      if (data.number) {
        var number = data.number.split('#').pop() || data.number.split('/').pop();
        html +=
          '<div class="mb-3"><strong>Number:</strong> <span class="ontolex-badge badge-number ms-2">' +
          number +
          '</span></div>';
      }

      // Signed form / video
      if (data.signedForm) {
        var sf = Array.isArray(data.signedForm) ? data.signedForm : [data.signedForm];
        html += '<div class="mb-3"><strong class="d-block mb-2">Signed Form(s):</strong><ul class="ps-3">';
        sf.forEach(function (s) {
          if (typeof s === 'object') {
            html += '<li class="small">Signed representation';
            if (s.signedRep) {
              var videos = Array.isArray(s.signedRep) ? s.signedRep : [s.signedRep];
              html += ' (';
              videos.forEach(function (v, idx) {
                if (idx > 0) html += ', ';
                if (typeof v === 'object' && v.url) {
                  html += '<a href="' + v.url + '" target="_blank">Video</a>';
                } else {
                  html += v;
                }
              });
              html += ')';
            }
            html += '</li>';
          } else {
            html += '<li class="small"><code>' + s + '</code></li>';
          }
        });
        html += '</ul></div>';
      }
    } else if (type === 'lexical_senses') {
      html += '<h6>Lexical Sense</h6>';
      html += '<p class="text-muted small mb-3"><strong>ID:</strong> <code>' + itemId + '</code></p>';

      if (data.definition) {
        html +=
          '<div class="mb-3"><strong class="d-block mb-2">Definition:</strong><div class="ps-3">' +
          data.definition +
          '</div></div>';
      }

      if (data.example) {
        html +=
          '<div class="mb-3"><strong class="d-block mb-2">Example:</strong><div class="ps-3 fst-italic">' +
          data.example +
          '</div></div>';
      }

      if (data.reference) {
        html += '<div class="mb-3"><strong>Reference:</strong> <span class="ms-2">' + data.reference + '</span></div>';
      }

      // Term metadata
      if (data.termType) {
        var termType = data.termType.split('#').pop() || data.termType.split('/').pop();
        html +=
          '<div class="mb-3"><strong>Term Type:</strong> <span class="ontolex-badge badge-termtype ms-2">' +
          termType +
          '</span></div>';
      }

      if (data.normativeAuthorization) {
        var normAuth = data.normativeAuthorization.split('#').pop() || data.normativeAuthorization.split('/').pop();
        html +=
          '<div class="mb-3"><strong>Normative Authorization:</strong> <span class="ontolex-badge badge-auth ms-2">' +
          normAuth +
          '</span></div>';
      }

      if (data.reliabilityCode) {
        html +=
          '<div class="mb-3"><strong>Reliability Code:</strong> <span class="ontolex-badge badge-reliability ms-2">' +
          data.reliabilityCode +
          '</span></div>';
      }

      if (data.isSenseOf) {
        var entryId = Array.isArray(data.isSenseOf) ? data.isSenseOf[0] : data.isSenseOf;
        html +=
          '<div class="mb-3"><strong>Sense Of:</strong> <a href="#" class="entity-link ms-2" data-type="lexical_entries" data-id="' +
          entryId +
          '"><i class="fas fa-link me-1"></i>' +
          entryId.split('/').pop() +
          '</a></div>';
      }

      if (data.lexicalConcept) {
        var conceptId = Array.isArray(data.lexicalConcept) ? data.lexicalConcept[0] : data.lexicalConcept;
        html +=
          '<div class="mb-3"><strong>Lexical Concept:</strong> <a href="#" class="entity-link ms-2" data-type="lexical_concepts" data-id="' +
          conceptId +
          '"><i class="fas fa-link me-1"></i>' +
          conceptId.split('/').pop() +
          '</a></div>';
      }

      if (data.synonym && data.synonym.length > 0) {
        html += '<div class="mb-3"><strong class="d-block mb-2">Synonyms (' + data.synonym.length + '):</strong>';
        html += '<ul class="list-unstyled ps-3">';
        data.synonym.slice(0, 10).forEach(function (synId) {
          html +=
            '<li class="mb-1"><a href="#" class="entity-link text-decoration-none" data-type="lexical_senses" data-id="' +
            synId +
            '"><i class="fas fa-link me-1"></i>' +
            synId.split('/').pop() +
            '</a></li>';
        });
        var _remainingSyn = data.synonym.slice(10);
        _remainingSyn.forEach(function (synId) {
          html +=
            '<li class="mb-1 ontolex-hidden-item d-none"><a href="#" class="entity-link text-decoration-none" data-type="lexical_senses" data-id="' +
            synId +
            '"><i class="fas fa-link me-1"></i>' +
            synId.split('/').pop() +
            '</a></li>';
        });
        if (_remainingSyn.length > 0) {
          html +=
            '<li><a href="#" class="ontolex-show-more text-muted small">... and ' +
            _remainingSyn.length +
            ' more</a></li>';
        }
        html += '</ul></div>';
      }

      if (data.translation && data.translation.length > 0) {
        html +=
          '<div class="mb-3"><strong class="d-block mb-2">Translations (' + data.translation.length + '):</strong>';
        html += '<ul class="list-unstyled ps-3">';
        data.translation.slice(0, 10).forEach(function (transId) {
          html +=
            '<li class="mb-1"><a href="#" class="entity-link text-decoration-none" data-type="lexical_senses" data-id="' +
            transId +
            '"><i class="fas fa-link me-1"></i>' +
            transId.split('/').pop() +
            '</a></li>';
        });
        var _remainingTrans = data.translation.slice(10);
        _remainingTrans.forEach(function (transId) {
          html +=
            '<li class="mb-1 ontolex-hidden-item d-none"><a href="#" class="entity-link text-decoration-none" data-type="lexical_senses" data-id="' +
            transId +
            '"><i class="fas fa-link me-1"></i>' +
            transId.split('/').pop() +
            '</a></li>';
        });
        if (_remainingTrans.length > 0) {
          html +=
            '<li><a href="#" class="ontolex-show-more text-muted small">... and ' +
            _remainingTrans.length +
            ' more</a></li>';
        }
        html += '</ul></div>';
      }

      // Usage examples (usageExample) and usages
      if (data.usageExample && data.usageExample.length > 0) {
        html +=
          '<div class="mb-3"><strong class="d-block mb-2">Usage Examples (' + data.usageExample.length + '):</strong>';
        html += '<ul class="list-unstyled ps-3">';
        data.usageExample.slice(0, 10).forEach(function (u) {
          if (typeof u === 'string') {
            html += '<li class="mb-2 small"><em>' + u + '</em></li>';
          } else if (typeof u === 'object') {
            var text = u.value || u.label || (u['@id'] ? u['@id'].split('/').pop().split('#').pop() : 'Example');
            html += '<li class="mb-2"><em class="small">' + text + '</em>';
            if (u.language) {
              html += ' <span class="ontolex-badge badge-language ms-2">' + u.language + '</span>';
            }
            if (u.source) {
              var sources = Array.isArray(u.source) ? u.source : [u.source];
              html += '<div class="text-muted small ms-3 mt-1">Source: ';
              sources.forEach(function (src, idx) {
                if (idx > 0) html += ', ';
                if (typeof src === 'object') {
                  // Try to get a meaningful text from the source object
                  var sourceText =
                    src.label || src.value || (src['@id'] ? src['@id'].split('/').pop().split('#').pop() : 'Reference');
                  html += sourceText;
                } else {
                  html += src;
                }
              });
              html += '</div>';
            }
            html += '</li>';
          } else {
            html += '<li class="mb-1 small">' + JSON.stringify(u) + '</li>';
          }
        });
        var _remainingUsageEx = data.usageExample.slice(10);
        _remainingUsageEx.forEach(function (u) {
          if (typeof u === 'string') {
            html += '<li class="mb-2 small ontolex-hidden-item d-none"><em>' + u + '</em></li>';
          } else if (typeof u === 'object') {
            var text = u.value || u.label || (u['@id'] ? u['@id'].split('/').pop().split('#').pop() : 'Example');
            html += '<li class="mb-2 ontolex-hidden-item d-none"><em class="small">' + text + '</em>';
            if (u.language) {
              html += ' <span class="ontolex-badge badge-language ms-2">' + u.language + '</span>';
            }
            if (u.source) {
              var sources = Array.isArray(u.source) ? u.source : [u.source];
              html += '<div class="text-muted small ms-3 mt-1">Source: ';
              sources.forEach(function (src, idx) {
                if (idx > 0) html += ', ';
                if (typeof src === 'object') {
                  var sourceText =
                    src.label || src.value || (src['@id'] ? src['@id'].split('/').pop().split('#').pop() : 'Reference');
                  html += sourceText;
                } else {
                  html += src;
                }
              });
              html += '</div>';
            }
            html += '</li>';
          } else {
            html += '<li class="mb-1 small ontolex-hidden-item d-none">' + JSON.stringify(u) + '</li>';
          }
        });
        if (_remainingUsageEx.length > 0) {
          html +=
            '<li><a href="#" class="ontolex-show-more text-muted small">... and ' +
            _remainingUsageEx.length +
            ' more</a></li>';
        }
        html += '</ul></div>';
      }

      if (data.usage && data.usage.length > 0) {
        html += '<div class="mb-3"><strong class="d-block mb-2">Usage Notes (' + data.usage.length + '):</strong>';
        html += '<ul class="list-unstyled ps-3">';
        data.usage.slice(0, 10).forEach(function (u) {
          if (typeof u === 'object') {
            var text = u.value || u.label || (u['@id'] ? u['@id'].split('/').pop().split('#').pop() : 'Usage note');
            html += '<li class="mb-2 small">' + text;
            if (u.language) {
              html += ' <span class="ontolex-badge badge-language ms-2">' + u.language + '</span>';
            }
            if (u.source) {
              var sources = Array.isArray(u.source) ? u.source : [u.source];
              html += '<div class="text-muted small ms-3 mt-1">Source: ';
              sources.forEach(function (src, idx) {
                if (idx > 0) html += ', ';
                if (typeof src === 'object') {
                  // Try to get a meaningful text from the source object
                  var sourceText =
                    src.label || src.value || (src['@id'] ? src['@id'].split('/').pop().split('#').pop() : 'Reference');
                  html += sourceText;
                } else {
                  html += src;
                }
              });
              html += '</div>';
            }
            html += '</li>';
          } else {
            html += '<li class="mb-1 small">' + (u.label || u || JSON.stringify(u)) + '</li>';
          }
        });
        var _remainingUsage = data.usage.slice(10);
        _remainingUsage.forEach(function (u) {
          if (typeof u === 'object') {
            var text = u.value || u.label || (u['@id'] ? u['@id'].split('/').pop().split('#').pop() : 'Usage note');
            html += '<li class="mb-2 small ontolex-hidden-item d-none">' + text;
            if (u.language) {
              html += ' <span class="ontolex-badge badge-language ms-2">' + u.language + '</span>';
            }
            if (u.source) {
              var sources = Array.isArray(u.source) ? u.source : [u.source];
              html += '<div class="text-muted small ms-3 mt-1">Source: ';
              sources.forEach(function (src, idx) {
                if (idx > 0) html += ', ';
                if (typeof src === 'object') {
                  var sourceText =
                    src.label || src.value || (src['@id'] ? src['@id'].split('/').pop().split('#').pop() : 'Reference');
                  html += sourceText;
                } else {
                  html += src;
                }
              });
              html += '</div>';
            }
            html += '</li>';
          } else {
            html +=
              '<li class="mb-1 small ontolex-hidden-item d-none">' + (u.label || u || JSON.stringify(u)) + '</li>';
          }
        });
        if (_remainingUsage.length > 0) {
          html +=
            '<li><a href="#" class="ontolex-show-more text-muted small">... and ' +
            _remainingUsage.length +
            ' more</a></li>';
        }
        html += '</ul></div>';
      }

      // References / provenance
      if (data.reference || data.references) {
        var refs = data.reference || data.references;
        refs = Array.isArray(refs) ? refs : [refs];
        html += '<div class="mb-3"><strong class="d-block mb-2">Reference(s):</strong><ul class="ps-3">';
        refs.forEach(function (r) {
          html += '<li class="small">' + (r.label || r || JSON.stringify(r)) + '</li>';
        });
        html += '</ul></div>';
      }
    }

    html += '</div>';
    return html;
  }

  return {
    init: init,
    loadEntity: loadEntity,
  };
})();
