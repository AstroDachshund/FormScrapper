const chromium = require("@sparticuz/chrome-aws-lambda");
const AWS = require("aws-sdk");

const s3 = new AWS.S3();

const s3Params = (key, body, contentType) => {
  return {
    Bucket: "test-edrone-hookforms",
    Key: key,
    Body: body,
    ContentType: contentType,
  };
};

exports.handler = async (event, context, callback) => {
  const getFormFromFooter = async domain => {
    let browser = null;
    let formsContent = [];
    let url = new URL(domain);
    try {
      browser = await chromium.puppeteer.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath,
        headless: chromium.headless,
        ignoreHTTPSErrors: true,
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1080, height: 1920, deviceScaleFactor: 1 });
      await page.goto(domain);
      const footer = await page.$("footer");
      if (!footer) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            message: "Footer not found",
          }),
        };
      }
      
      const forms = await page.$$("footer form");
      console.log(forms.length);
      if (forms.length === 0) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            message: "No forms found",
          }),
        };
      }
      formsContent = await page.$$eval("footer form", (forms) => {
        const getAttributes = (element) => {
          //Get attributes of element
          const attrs = element.getAttributeNames().reduce((acc, name) => {
            return { ...acc, [name]: element.getAttribute(name) };
          }, {});
          return attrs;
        };
        function getFormContent(form) {
          const formData = new FormData(form);
          let formDataObject = new Object();
          let content = new Object();
          let inputAttrs = new Object();
          let hasEmail;

          formDataObject.formAttributes = getAttributes(form);
          formDataObject.location_url = window.location.href;

          for (const pair of formData.entries()) {
            //Exclude password field
            if (pair[0].indexOf("password") < 0 && pair[0].indexOf("pass") < 0) {
              if (pair[0].indexOf("email") > -1) {
                hasEmail = true;
              }
              content[pair[0]] = pair[1];
            }
          }
          formDataObject.formDataContent = content;
          //Get form inputs
          const formInputs = form.querySelectorAll("input, [type='submit']");
          formInputs.forEach((input, index) => {
            let temp = getAttributes(input);
            if (temp.type !== "password") {
              if (temp.type === "checkbox") {
                temp.checked = input.checked;
              }
              inputAttrs[index] = temp;
            }
          });
          formDataObject.formInputs = inputAttrs;

          return {
            content: formDataObject,
            hasEmail: hasEmail,
          };
        }
        return forms.map((form) => {
          if (getFormContent(form).hasEmail) {
            return JSON.stringify(getFormContent(form).content);
          }
        });
      });
    } catch (error) {
      return callback(error);
    } finally {
      if (browser !== null) await browser.close();
    }

    let result = null;

    try {
      result = await Promise.all(
        formsContent.map(async (formContent, index) => {
          const key = `${url.hostname}/form${index}.json`;
          const params = s3Params(key, formContent, "application/json");
          return await s3.putObject(params).promise();
        })
      );
    } catch (error) {
      return callback(error);
    }
    return callback(null, {
      statusCode: 200,
      body: result,
    });
  };
  if (event.Records) {
    await Promise.all(
      event.Records.map(async record => {
        const domain = record.body;
        return await getFormFromFooter(domain);
      }
    ));
  }
  if (event.body) {
    let body = JSON.parse(event.body);
    console.log(body.url);
    return await getFormFromFooter(body.url);
  }
};
