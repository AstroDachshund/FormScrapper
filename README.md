# FormScrapper
This is a script that works in collaboration with AWS Lambda.
The script breaks down into individual steps:
1. Web Scrapper launches a headless browser on the URL specified in the request, then scans the HTML and looks for the form element in the footer of the page.
2. Scrapper stores a filr of the attributes of the form itself in JSON, and collects the attributes from each input inside.
3. Finally, it takes a screenshot of the form and sends it along with the JSON to S3 Bucket.

