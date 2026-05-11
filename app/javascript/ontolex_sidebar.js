/* eslint-disable no-undef */
/**
 * Generic OntoLex Sidebar Manager
 * Handles pagination, loading states, search, and item rendering for OntoLex entity sidebars
 */
window.OntolexSidebar = {
  /**
   * Initialize a sidebar for an OntoLex entity type
   * @param {Object} config - Configuration object
   * @param {string} config.containerId - ID of the sidebar container element
   * @param {string} config.entityType - Type of entity (e.g., 'forms', 'lexical_entries', etc.)
   * @param {string} config.ontologyAcronym - Ontology acronym
   * @param {string} config.externalRestUrl - Base URL for API calls
   * @param {string} config.apikey - API key for authentication
   * @param {number} config.pageSize - Number of items per page (default: 50)
   * @param {Function} config.renderItem - Function to render a single item
   * @param {Function} config.onItemSelect - Callback when an item is selected
   * @param {Function} config.getBadgeProperty - Function to extract badge property from item (optional)
   * @param {string} config.noItemsMessage - Message to show when no items found
   * @param {string} config.searchPlaceholder - Placeholder text for search box (optional)
   */
  create: function (config) {
    var state = {
      currentPage: 1,
      pageSize: config.pageSize || 50,
      selectedItemId: null,
      searchQuery: '',
      searchDebounceTimer: null,
      currentXhr: null, // Track current AJAX request for cancellation
      containerId: config.containerId,
      entityType: config.entityType,
      ontologyAcronym: config.ontologyAcronym,
      externalRestUrl: config.externalRestUrl,
      apikey: config.apikey,
      renderItem: config.renderItem,
      onItemSelect: config.onItemSelect,
      getBadgeProperty: config.getBadgeProperty || null,
      noItemsMessage: config.noItemsMessage || 'No items found',
      searchPlaceholder: config.searchPlaceholder || 'Search...',
      preloadData: config.preloadData || null,
      skipAutoSelect: config.skipAutoSelect || false,
      initialItemId: config.initialItemId || null, // ID to find and select on initial load
      currentItems: [],
      pendingEnterSelectionQuery: null,
    };

    var api = {
      /**
       * Load a page, optionally finding the page that contains a specific item
       * @param {number} page - Page number to load (ignored if findId is provided)
       * @param {string} findId - Optional: Item ID to find - API will return the page containing this item
       */
      loadPage: function (page, findId) {
        // Cancel any in-flight request
        if (state.currentXhr) {
          state.currentXhr.abort();
          state.currentXhr = null;
        }

        state.currentPage = page;
        this.showLoading();

        var apiUrl =
          state.externalRestUrl +
          '/ontologies/' +
          state.ontologyAcronym +
          '/' +
          state.entityType +
          '?page=' +
          page +
          '&pagesize=' +
          state.pageSize +
          '&apikey=' +
          state.apikey;

        if (state.searchQuery && state.searchQuery.trim() !== '') {
          apiUrl += '&q=' + encodeURIComponent(state.searchQuery.trim());
        }

        // If findId is provided, add it to the API call so the server returns the correct page
        if (findId) {
          apiUrl += '&find_id=' + encodeURIComponent(findId);
        }

        var self = this;
        var findingItem = !!findId;
        state.currentXhr = $.ajax({
          url: apiUrl,
          method: 'GET',
          dataType: 'json',
          success: function (data) {
            state.currentXhr = null;
            var items = data.collection || [];

            if (data.page) {
              state.currentPage = data.page;
            }

            self.renderSidebar(items, data);

            // If we were finding a specific item, highlight it now
            if (findingItem && state.initialItemId) {
              self.highlightItem(state.initialItemId);
              // Also trigger the onItemSelect callback to load the item details
              if (state.onItemSelect) {
                state.onItemSelect(state.initialItemId);
              }
              // Clear initialItemId after first use
              state.initialItemId = null;
            }

            if (state.preloadData) {
              state.preloadData(items, state, self);
            }
          },
          error: function (xhr, status, error) {
            state.currentXhr = null;
            // Don't show error for aborted requests
            if (status === 'abort') return;

            self.renderError(error);
          },
        });
      },

      showLoading: function () {
        // Only update the list area, keep the search box intact
        var $container = $('#' + state.containerId);
        var $searchBox = $container.find('.ontolex-search-box');

        if ($searchBox.length === 0) {
          // First load - render everything
          var html = this.renderSearchBox();
          html += '<div class="ontolex-results-area"><div class="text-center py-3">';
          html += '<span class="spinner-border spinner-border-sm" role="status"></span>';
          html += '</div></div>';
          $container.html(html);
          this.attachSearchHandler();
        } else {
          // Subsequent loads - only update results area
          var $resultsArea = $container.find('.ontolex-results-area');
          if ($resultsArea.length === 0) {
            $container.append('<div class="ontolex-results-area"></div>');
            $resultsArea = $container.find('.ontolex-results-area');
          }
          $resultsArea.html(
            '<div class="text-center py-3"><span class="spinner-border spinner-border-sm" role="status"></span></div>',
          );
        }
      },

      renderError: function (error) {
        var $container = $('#' + state.containerId);
        var $resultsArea = $container.find('.ontolex-results-area');
        if ($resultsArea.length > 0) {
          $resultsArea.html('<div class="alert alert-danger m-2">Error: ' + error + '</div>');
        } else {
          $container.html(
            this.renderSearchBox() +
              '<div class="ontolex-results-area"><div class="alert alert-danger m-2">Error: ' +
              error +
              '</div></div>',
          );
          this.attachSearchHandler();
        }
      },

      renderSearchBox: function () {
        var html = '<div class="ontolex-search-box p-2">';
        html += '<div class="input-group input-group-sm">';
        html += '<input type="text" class="form-control" ';
        html += 'id="' + state.containerId + '-search" ';
        html += 'list="' + state.containerId + '-search-suggestions" ';
        html += 'placeholder="' + state.searchPlaceholder + '" ';
        html += 'value="' + this.escapeHtml(state.searchQuery || '') + '">';
        html +=
          '<button class="btn btn-outline-secondary" type="button" id="' +
          state.containerId +
          '-search-btn" title="Search">';
        html += '<i class="fas fa-search"></i>';
        html += '</button>';
        html += '</div>';
        html += '<datalist id="' + state.containerId + '-search-suggestions"></datalist>';
        html += '</div>';
        return html;
      },

      getItemLabels: function (item) {
        var labels = [];

        if (Array.isArray(item.writtenReps)) {
          labels = labels.concat(item.writtenReps);
        }

        if (typeof item.writtenRep === 'string') {
          labels.push(item.writtenRep);
        }

        if (typeof item.lemma === 'string') {
          labels.push(item.lemma);
        }

        if (typeof item.prefLabel === 'string') {
          labels.push(item.prefLabel);
        }

        if (typeof item.label === 'string') {
          labels.push(item.label);
        }

        var itemId = item['@id'] || item.id;
        if (itemId) {
          labels.push(itemId.toString().split('/').pop());
        }

        return labels
          .map(function (label) {
            return (label || '').toString().trim();
          })
          .filter(function (label) {
            return label.length > 0;
          });
      },

      normalizeText: function (value) {
        return (value || '').toString().trim().toLowerCase();
      },

      updateSearchSuggestions: function (items) {
        var $datalist = $('#' + state.containerId + '-search-suggestions');
        if ($datalist.length === 0) return;

        var seen = {};
        var suggestions = [];
        for (var i = 0; i < items.length; i++) {
          var labels = this.getItemLabels(items[i]);
          for (var j = 0; j < labels.length; j++) {
            var label = labels[j];
            var key = this.normalizeText(label);
            if (!seen[key]) {
              seen[key] = true;
              suggestions.push(label);
            }
            if (suggestions.length >= 20) break;
          }
          if (suggestions.length >= 20) break;
        }

        var html = suggestions
          .map(function (label) {
            return '<option value="' + $('<div>').text(label).html() + '"></option>';
          })
          .join('');

        $datalist.html(html);
      },

      selectBestMatchForQuery: function (query) {
        if (!state.currentItems || state.currentItems.length === 0) {
          return false;
        }

        var normalizedQuery = this.normalizeText(query);
        if (!normalizedQuery) {
          return false;
        }

        var bestItem = null;
        var containsItem = null;
        var bestIndex = null;
        var containsIndex = null;

        for (var i = 0; i < state.currentItems.length; i++) {
          var item = state.currentItems[i];
          var labels = this.getItemLabels(item);

          for (var j = 0; j < labels.length; j++) {
            var normalizedLabel = this.normalizeText(labels[j]);

            if (normalizedLabel === normalizedQuery) {
              bestItem = item;
              bestIndex = i;
              break;
            }

            if (!bestItem && normalizedLabel.indexOf(normalizedQuery) === 0) {
              bestItem = item;
              bestIndex = i;
            }

            if (!containsItem && normalizedLabel.indexOf(normalizedQuery) > -1) {
              containsItem = item;
              containsIndex = i;
            }
          }

          if (bestItem && this.getItemLabels(bestItem).some(function (label) { return label.toLowerCase() === normalizedQuery; })) {
            break;
          }
        }

        var itemToSelect = bestItem || containsItem || state.currentItems[0];
        var indexToSelect = bestItem ? bestIndex : containsItem ? containsIndex : 0;
        if (!itemToSelect) {
          return false;
        }

        var $items = $('#' + state.containerId + ' .ontolex-sidebar-item');
        if ($items.length > indexToSelect && indexToSelect >= 0) {
          $items.eq(indexToSelect).trigger('click');
          return true;
        }

        var itemId = itemToSelect['@id'] || itemToSelect.id;
        if (!itemId) {
          return false;
        }

        this.selectItem(itemId);
        return true;
      },

      escapeHtml: function (text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      },

      renderSidebar: function (items, data) {
        var $container = $('#' + state.containerId);
        var $resultsArea = $container.find('.ontolex-results-area');
        state.currentItems = items || [];

        var html = '';
        if (items.length === 0) {
          html += '<div class="text-center text-muted p-3">';
          html += '<i class="fas fa-inbox"></i>';
          html += '<p class="mt-2">' + state.noItemsMessage + '</p>';
          html += '</div>';
        } else {
          html += '<ul class="ontolex-sidebar-list list-unstyled">';

          for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var itemId = item['@id'] || item.id || 'Unknown';
            var activeClass = state.selectedItemId === itemId ? ' active' : '';

            html += '<li class="ontolex-sidebar-item' + activeClass + '" data-id="' + itemId + '">';
            html += state.renderItem(item);
            html += '</li>';
          }

          html += '</ul>';

          if (data.pageCount && data.pageCount > 1) {
            html += this.renderPagination(data);
          }
        }

        if ($resultsArea.length > 0) {
          $resultsArea.html(html);
        } else {
          $container.html(this.renderSearchBox() + '<div class="ontolex-results-area">' + html + '</div>');
          this.attachSearchHandler();
        }

        this.updateSearchSuggestions(state.currentItems);

        this.attachEventHandlers(items);

        // Keep results and details in sync after a search: show the best matching entry.
        if (state.searchQuery && state.searchQuery.trim() !== '' && items.length > 0) {
          this.selectBestMatchForQuery(state.searchQuery);
        }

        if (state.pendingEnterSelectionQuery !== null) {
          this.selectBestMatchForQuery(state.pendingEnterSelectionQuery);
          state.pendingEnterSelectionQuery = null;
        }
      },

      renderPagination: function (data) {
        var html = '<div class="ontolex-sidebar-pagination p-2">';
        html += '<nav aria-label="Pagination"><ul class="pagination pagination-sm justify-content-center mb-0">';

        if (data.page > 1) {
          html += '<li class="page-item"><a class="page-link" href="#" data-page="' + (data.page - 1) + '">‹</a></li>';
        } else {
          html += '<li class="page-item disabled"><span class="page-link">‹</span></li>';
        }

        html +=
          '<li class="page-item disabled"><span class="page-link">' +
          data.page +
          ' / ' +
          data.pageCount +
          '</span></li>';

        if (data.page < data.pageCount) {
          html += '<li class="page-item"><a class="page-link" href="#" data-page="' + (data.page + 1) + '">›</a></li>';
        } else {
          html += '<li class="page-item disabled"><span class="page-link">›</span></li>';
        }

        html += '</ul></nav></div>';
        return html;
      },

      attachSearchHandler: function () {
        var self = this;
        var $searchInput = $('#' + state.containerId + '-search');
        var $searchBtn = $('#' + state.containerId + '-search-btn');

        // Trigger search function
        var doSearch = function (triggeredByEnter) {
          var query = ($searchInput.val() || '').trim();
          // Only search if query changed
          if (query !== state.searchQuery) {
            state.searchQuery = query;
            state.currentPage = 1;
            state.pendingEnterSelectionQuery = triggeredByEnter ? query : null;
            self.loadPage(1);
          } else if (triggeredByEnter) {
            self.selectBestMatchForQuery(query);
          }
        };

        var doSearchDebounced = function () {
          if (state.searchDebounceTimer) {
            clearTimeout(state.searchDebounceTimer);
          }
          state.searchDebounceTimer = setTimeout(function () {
            doSearch(false);
          }, 250);
        };

        // Handle Enter key
        $searchInput.off('keydown keypress').on('keydown keypress', function (e) {
          if (e.key === 'Enter' || e.which === 13) {
            e.preventDefault();
            doSearch(true);
          }
        });

        // Autocomplete-like live search while typing
        $searchInput.off('input').on('input', function () {
          doSearchDebounced();
        });

        // Handle search button click
        $searchBtn.off('click').on('click', function () {
          doSearch(true);
        });
      },
      attachEventHandlers: function (items) {
        var self = this;

        // Item click handlers
        $('#' + state.containerId + ' .ontolex-sidebar-item')
          .off('click')
          .on('click', function () {
            var itemId = $(this).data('id');
            state.selectedItemId = itemId;

            $('#' + state.containerId + ' .ontolex-sidebar-item').removeClass('active');
            $(this).addClass('active');

            if (state.onItemSelect) {
              state.onItemSelect(itemId);
            }
          });

        // Pagination click handlers
        $('#' + state.containerId + ' .pagination a')
          .off('click')
          .on('click', function (e) {
            e.preventDefault();
            var page = $(this).data('page');
            state.currentPage = page;
            self.loadPage(page);
          });

        // Auto-select first item if none selected (unless skipAutoSelect is true)
        if (!state.skipAutoSelect && !state.selectedItemId && items.length > 0) {
          var firstId = items[0]['@id'] || items[0].id;
          state.selectedItemId = firstId;
          $('#' + state.containerId + ' .ontolex-sidebar-item')
            .first()
            .addClass('active');

          if (state.onItemSelect) {
            state.onItemSelect(firstId);
          }
        }
      },

      selectItem: function (itemId) {
        state.selectedItemId = itemId;

        // Update visual selection in sidebar
        $('#' + state.containerId + ' .ontolex-sidebar-item').removeClass('active');
        var $item = $('#' + state.containerId + ' .ontolex-sidebar-item[data-id="' + itemId + '"]');

        if ($item.length > 0) {
          // Item is on current page, highlight it
          $item.addClass('active');
          // Remove any "not on page" indicator
          $('#' + state.containerId + ' .ontolex-not-on-page-indicator').remove();
        }

        if (state.onItemSelect) {
          state.onItemSelect(itemId);
        }
      },

      // Method to update sidebar selection without triggering onItemSelect
      highlightItem: function (itemId) {
        state.selectedItemId = itemId;
        $('#' + state.containerId + ' .ontolex-sidebar-item').removeClass('active');
        var $item = $('#' + state.containerId + ' .ontolex-sidebar-item[data-id="' + itemId + '"]');

        if ($item.length > 0) {
          $item.addClass('active');
          $('#' + state.containerId + ' .ontolex-not-on-page-indicator').remove();
          $item[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      },

      clearSearch: function () {
        state.searchQuery = '';
        state.currentPage = 1;
        this.loadPage(1);
      },

      getSearchQuery: function () {
        return state.searchQuery;
      },

      getState: function () {
        return state;
      },

      /**
       * Find the page containing a specific item and load it, then select that item
       * @param {string} itemId - The ID of the item to find and select
       */
      findAndSelectItem: function (itemId) {
        state.selectedItemId = itemId;
        state.initialItemId = itemId;

        // Load page 1 with find_id parameter - API will return the page containing the item
        this.loadPage(1, itemId);
      },
    };

    return api;
  },

  /**
   * Common item renderer for entities with writtenRep/lemma and badge
   */
  createSimpleItemRenderer: function (displayProp, badgeProp) {
    return function (item) {
      var itemId = item['@id'] || item.id || 'Unknown';
      var displayText = item[displayProp] || itemId.split('/').pop();

      var html = '<div>' + displayText + '</div>';

      if (badgeProp && item[badgeProp]) {
        var badgeValue = item[badgeProp].split('/').pop();
        html +=
          '<div class="mt-1"><span class="ontolex-badge badge-language" title="' +
          item[badgeProp] +
          '">' +
          badgeValue +
          '</span></div>';
      }

      return html;
    };
  },

  /**
   * Item renderer with multiple badges
   */
  createMultiBadgeItemRenderer: function (displayProp, badgeProps) {
    return function (item) {
      var itemId = item['@id'] || item.id || 'Unknown';
      var displayText = item[displayProp] || itemId.split('/').pop();

      var html = '<div>' + displayText + '</div>';

      if (badgeProps && badgeProps.length > 0) {
        var badges = [];
        for (var i = 0; i < badgeProps.length; i++) {
          var prop = badgeProps[i];
          if (item[prop]) {
            var badgeValue = item[prop].split('#').pop() || item[prop].split('/').pop();
            badges.push(
              '<span class="ontolex-badge badge-' + prop + '" title="' + item[prop] + '">' + badgeValue + '</span>',
            );
          }
        }
        if (badges.length > 0) {
          html += '<div class="mt-1">' + badges.join(' ') + '</div>';
        }
      }

      return html;
    };
  },
};
