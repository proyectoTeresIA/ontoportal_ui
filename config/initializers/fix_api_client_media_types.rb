# Monkey patch to fix media type mismatch between client and API
# The client expects 'http://data.bioontology.org/metadata/...' but the API returns 'http://api-agraph:9393/metadata/...'

module LinkedData
  module Client
    module Collection
      module ClassMethods
        # Override uri_from_context to handle both bioontology.org and local API media types
        def uri_from_context(object, media_type)
          # First try the original media type
          object.links.each do |type, link|
            return link if link.media_type && link.media_type.downcase.eql?(media_type.downcase)
          end
          
          # If not found and media_type contains data.bioontology.org, try with local API host
          if media_type.include?('data.bioontology.org')
            local_media_type = media_type.gsub('data.bioontology.org', LinkedData::Client.settings.rest_url.gsub('http://', '').gsub('https://', ''))
            object.links.each do |type, link|
              return link if link.media_type && link.media_type.downcase.eql?(local_media_type.downcase)
            end
          end
          
          # If still not found, return nil (original behavior)
          nil
        end
      end
    end
  end
end
