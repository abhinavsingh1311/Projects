﻿// <auto-generated> This file has been auto generated by EF Core Power Tools. </auto-generated>
#nullable disable
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ReceivingSystem.Entities;

[Table("Part")]
internal partial class Part
{
	[Key]
	public int PartId { get; set; }

	[Required]
	[StringLength(40)]
	public string Description { get; set; }

	[Column(TypeName = "smallmoney")]
	public decimal PurchasePrice { get; set; }

	[Column(TypeName = "smallmoney")]
	public decimal SellingPrice { get; set; }

	public int QuantityOnHand { get; set; }

	public int ReorderLevel { get; set; }

	public int QuantityOnOrder { get; set; }

	public int CategoryId { get; set; }

	[StringLength(1)]
	public string Refundable { get; set; }

	public bool Discontinued { get; set; }

	public int VendorId { get; set; }

	public bool RemoveFromViewFlag { get; set; }

	[ForeignKey("VendorId")]
	[InverseProperty("Parts")]
	public virtual Vendor Vendor { get; set; }

	[InverseProperty("Part")]
	public virtual ICollection<PurchaseOrderDetail> PurchaseOrderDetails { get; set; } = new List<PurchaseOrderDetail>();
}
