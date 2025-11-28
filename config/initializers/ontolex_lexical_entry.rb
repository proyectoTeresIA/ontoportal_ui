# Add LexicalEntry model to the ontologies_api_client for OntoLex ontology support
# This is loaded after ontologies_api_client.rb to extend the client

module LinkedData
  module Client
    module Models
      class LexicalEntry < LinkedData::Client::Base
        @media_type = %w[http://www.w3.org/ns/lemon/ontolex#LexicalEntry]
        @include_attrs = "prefLabel,definition,synonym,obsolete,hasChildren"
        @attrs_always_present = :prefLabel, :definition, :synonym, :obsolete, :hasChildren

        alias :fullId :id

        def prefLabel(options = {})
          if options[:use_html]
            return "<span class='prefLabel'>#{@prefLabel}</span>"
          else
            return @prefLabel
          end
        end

        def ontology
          self.explore.ontology
        end
      end
    end
  end
end
