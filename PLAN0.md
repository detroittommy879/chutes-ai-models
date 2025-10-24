

add these columns to the app, and add/change any code needed to find and store the info from models if it doesn't already. The input output column should be separated into input, and output, context should be input and output context columns. 

1.   "input_modalities": ["text", "image", "audio"], -- sometimes it still says text text even for some image editing or video models, not sure why this is 
2.   "output_modalities": ["text", "image", "audio"]
(I know these already are displayed but it is only in one column and you can't see them separately (input/output) same with the context size, there should be two in/out columns for context also. 

3.  "supported_sampling_parameters": [ -- maybe we should also add these
        "temperature", "top_p", "top_k", "repetition_penalty", 
        "frequency_penalty", "presence_penalty", "stop", "seed"
      ],''' to a column similar to the column that lists json, structured outputs, tool use etc. - we should not have all of that inside the context column like it currently is (there should be separate input and output context columns)


4. public or private? 	Boolean	Indicates if the chute is publicly accessible and useable. public shows up for some models at 
https://api.chutes.ai/chutes/  but sometimes, it is just missing (doesn't specify either private or public) if the data is missing we should just say unknown instead of assuming it is private

if you put a chutes uuid in the url like:
https://api.chutes.ai/chutes/25f25a8a-7e77-548b-ba76-a592eab45233 
you will get much more or just different information about each model so maybe we can try different api methods and combine all the info into a unified store of it
'''


