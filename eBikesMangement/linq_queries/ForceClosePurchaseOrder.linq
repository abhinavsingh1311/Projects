<Query Kind="Program">
  <Connection>
    <ID>f33d1a5f-7b5a-41b0-b948-17d919659c45</ID>
    <NamingServiceVersion>2</NamingServiceVersion>
    <Persist>true</Persist>
    <Driver Assembly="(internal)" PublicKeyToken="no-strong-name">LINQPad.Drivers.EFCore.DynamicDriver</Driver>
    <AllowDateOnlyTimeOnly>true</AllowDateOnlyTimeOnly>
    <Server>ABHINAV-SCHOOL</Server>
    <Database>eBike_2025</Database>
    <DriverData>
      <EncryptSqlTraffic>True</EncryptSqlTraffic>
      <PreserveNumeric1>True</PreserveNumeric1>
      <EFProvider>Microsoft.EntityFrameworkCore.SqlServer</EFProvider>
    </DriverData>
  </Connection>
  <Namespace>Receiving</Namespace>
</Query>

#load "c:\dmit2018\linq_queries\PurchaseOrderView.linq"
#load "c:\dmit2018\linq_queries\ReceivingDetailView.linq"
#load "c:\dmit2018\linq_queries\UnorderedReturnItemView.linq"


void Main()
{
	
}

public void ForceClosePurchaseOrder(int purchaseOrderID, string employeeId, List<ReceivingDetailView> receivingDetails, List<UnorderedReturnItemView> unorderedReturnItems, string reason)
		{
			try
			{
				// Validate reason
				if (string.IsNullOrWhiteSpace(reason))
				{
					throw new ArgumentException("A reason must be provided when force closing a purchase order.");
				}

				PurchaseOrder purchaseOrder = PurchaseOrders.Find(purchaseOrderID);

				if (purchaseOrder == null)
				{
					throw new ArgumentException($"Purchase order with ID {purchaseOrderID} was not found.");
				}

				foreach (ReceivingDetailView receivingDetail in receivingDetails)
				{
					Part updatePart = Parts.Find(receivingDetail.PartID);

					if (updatePart != null)
					{
						updatePart.QuantityOnOrder -= receivingDetail.Outstanding;
					}
				}

				purchaseOrder.Notes = reason;
				purchaseOrder.Closed = true;

				SaveChanges();
			}
			catch (ArgumentNullException ex)
			{
				throw new ArgumentNullException(ex.Message);
			}
			catch (ArgumentException ex)
			{
				throw new ArgumentException(ex.Message);
			}
			catch (AggregateException ex)
			{
				List<Exception> errorList = new();
				foreach (var error in ex.InnerExceptions)
				{
					errorList.Add(new Exception(error.Message));
				}
				throw new AggregateException(ex.Message, errorList);
			}
			catch (Exception ex)
			{
				throw new Exception($"An error occurred while force closing the purchase order: {ex.Message}", ex);
			}
		}
	